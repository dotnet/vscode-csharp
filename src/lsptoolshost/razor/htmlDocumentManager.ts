/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLogger } from '../../razor/src/razorLogger';
import { PlatformInformation } from '../../shared/platform';
import { getUriPath } from '../../razor/src/uriPaths';
import { HtmlDocumentContentProvider } from './htmlDocumentContentProvider';
import { HtmlDocument } from './htmlDocument';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { RequestType, TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { UriConverter } from '../utils/uriConverter';

const virtualHtmlSuffix = '__virtual.html';

export class HtmlDocumentManager {
    private readonly htmlDocuments: { [hostDocumentPath: string]: HtmlDocument } = {};
    private readonly contentProvider: HtmlDocumentContentProvider;
    private readonly pendingUpdates: {
        [documentPath: string]: {
            promise: Promise<void>;
            resolve: () => void;
            reject: (error: any) => void;
        };
    } = {};

    private readonly razorDocumentClosedRequest: RequestType<TextDocumentIdentifier, void, Error> = new RequestType(
        'razor/documentClosed'
    );

    constructor(
        private readonly platformInfo: PlatformInformation,
        private readonly roslynLanguageServer: RoslynLanguageServer,
        private readonly logger: RazorLogger
    ) {
        this.contentProvider = new HtmlDocumentContentProvider(this, this.logger);
    }

    public get documents() {
        return Object.values(this.htmlDocuments);
    }

    public register() {
        const didChangeRegistration = vscode.workspace.onDidChangeTextDocument((e) => {
            // Check if this document is being monitored for updates
            if (e.document.uri.scheme === HtmlDocumentContentProvider.scheme) {
                const documentPath = getUriPath(e.document.uri);
                const pendingUpdate = this.pendingUpdates[documentPath];

                if (pendingUpdate) {
                    // Document has been updated, resolve the promise
                    pendingUpdate.resolve();
                    delete this.pendingUpdates[documentPath];
                }
            }
        });

        const didCloseRegistration = vscode.workspace.onDidCloseTextDocument(async (document) => {
            // We log when a virtual document is closed just in case it helps track down future bugs
            if (document.uri.scheme === HtmlDocumentContentProvider.scheme) {
                this.logger.logTrace(`Virtual document '${document.uri}' timed out.`);
                return;
            }

            // When a Razor document is closed, only then can we be sure its okay to remove the virtual document.
            if (document.languageId === 'aspnetcorerazor') {
                this.logger.logTrace(`Document '${document.uri}' was closed.`);

                await this.closeDocument(document.uri);

                // We don't care about the response, but Razor cohosting can't currently do notifications with documents
                // so making it a request means the logs end up in the right place.
                await this.roslynLanguageServer.sendRequest(
                    this.razorDocumentClosedRequest,
                    TextDocumentIdentifier.create(UriConverter.serialize(document.uri)),
                    new vscode.CancellationTokenSource().token
                );
            }
        });

        const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
            HtmlDocumentContentProvider.scheme,
            this.contentProvider
        );

        return vscode.Disposable.from(didChangeRegistration, didCloseRegistration, providerRegistration);
    }

    public async updateDocumentText(uri: vscode.Uri, checksum: string, text: string) {
        // We don't pass the checksum in here, because we'd be comparing the new one against the old one.
        let document = await this.findDocument(uri);

        if (!document) {
            this.logger.logTrace(
                `File '${uri}' didn't exist in the Razor document list, so adding it with checksum '${checksum}'.`
            );
            document = this.addDocument(uri, checksum);
        }

        this.logger.logTrace(`New content for '${uri}', updating '${document.path}', checksum '${checksum}'.`);

        // Create a promise for this document update
        let resolve: () => void;
        let reject: (error: any) => void;
        const updatePromise = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        this.pendingUpdates[document.path] = { promise: updatePromise, resolve: resolve!, reject: reject! };

        // Now update the document and fire the change event so VS Code will inform the Html language client.
        await vscode.workspace.openTextDocument(document.uri);

        document.setContent(checksum, text);

        this.contentProvider.fireDidChange(document.uri);
    }

    private async closeDocument(uri: vscode.Uri) {
        const document = await this.findDocument(uri);

        if (document) {
            this.logger.logTrace(`Removing '${document.uri}' from the document manager.`);

            // Clean up any pending update promises for this document
            const pendingUpdate = this.pendingUpdates[document.path];
            if (pendingUpdate) {
                pendingUpdate.reject(new Error('Document was closed before update completed'));
                delete this.pendingUpdates[document.path];
            }

            delete this.htmlDocuments[document.path];
        }
    }

    public async getDocument(uri: vscode.Uri, checksum?: string): Promise<HtmlDocument | undefined> {
        const document = this.findDocument(uri);

        if (!document) {
            this.logger.logTrace(`File '${uri}' didn't exist in the Razor document list. Doing nothing.`);
            return undefined;
        }

        if (checksum && document.getChecksum() !== checksum) {
            this.logger.logInfo(
                `Found '${uri}' in the Razor document list, but the checksum '${document.getChecksum()}' doesn't match '${checksum}'.`
            );
            return undefined;
        }

        await vscode.workspace.openTextDocument(document.uri);

        if (checksum) {
            // If checksum is supplied, that means we're getting this document because we're about to call an LSP method
            // on it. We know that we've got the right document, and we've been told about the right content by the server,
            // but all we can be sure of at this point is that we've fired the change event for it. The event firing
            // is async, and the didChange notification that it would generate is a notification, so doesn't necessarily
            // block. Before we actually make a call to the Html server, we should at least make sure that the document
            // update has been seen by VS Code. We can't get access to the Html language client specifically to check if it
            // has seen it, but we can trust that ordering will be preserved at least.
            const pendingUpdate = this.pendingUpdates[document.path];
            if (pendingUpdate) {
                try {
                    // Wait for the update promise with a 5 second timeout
                    await Promise.race([
                        pendingUpdate.promise,
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Document update timeout')), 5000)
                        ),
                    ]);
                } catch (error) {
                    this.logger.logWarning(`Failed to wait for document update: ${error}`);
                } finally {
                    // Clean up the promise reference
                    delete this.pendingUpdates[document.path];
                }
            }
        }

        return document;
    }

    private addDocument(uri: vscode.Uri, checksum: string): HtmlDocument {
        let document = this.findDocument(uri);
        if (document) {
            this.logger.logInfo(`Skipping document creation for '${document.path}' because it already exists.`);
            return document;
        }

        document = this.createDocument(uri, checksum);
        this.htmlDocuments[document.path] = document;

        return document;
    }

    private findDocument(uri: vscode.Uri): HtmlDocument | undefined {
        let path = getUriPath(uri);

        // We might be passed a Razor document Uri, but we store and manage Html projected documents.
        if (uri.scheme !== HtmlDocumentContentProvider.scheme) {
            path = `${path}${virtualHtmlSuffix}`;
        }

        if (this.platformInfo.isLinux()) {
            return this.htmlDocuments[path];
        }

        return Object.values(this.htmlDocuments).find(
            (document) => document.path.localeCompare(path, undefined, { sensitivity: 'base' }) === 0
        );
    }

    private createDocument(uri: vscode.Uri, checksum: string) {
        uri = uri.with({
            scheme: HtmlDocumentContentProvider.scheme,
            path: `${uri.path}${virtualHtmlSuffix}`,
        });
        const projectedDocument = new HtmlDocument(uri, checksum);

        return projectedDocument;
    }
}
