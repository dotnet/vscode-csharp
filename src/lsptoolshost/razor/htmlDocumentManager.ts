/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLogger } from '../../razor/src/razorLogger';
import { PlatformInformation } from '../../shared/platform';
import { getUriPath } from '../../razor/src/uriPaths';
import { virtualHtmlSuffix } from '../../razor/src/razorConventions';
import { HtmlDocumentContentProvider } from './htmlDocumentContentProvider';
import { HtmlDocument } from './htmlDocument';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { RequestType, TextDocumentIdentifier } from 'vscode-languageserver-protocol';

export class HtmlDocumentManager {
    private readonly htmlDocuments: { [hostDocumentPath: string]: HtmlDocument } = {};
    private readonly contentProvider: HtmlDocumentContentProvider;

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
                    TextDocumentIdentifier.create(getUriPath(document.uri)),
                    new vscode.CancellationTokenSource().token
                );
            }
        });

        const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
            HtmlDocumentContentProvider.scheme,
            this.contentProvider
        );

        return vscode.Disposable.from(didCloseRegistration, providerRegistration);
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

        await vscode.workspace.openTextDocument(document.uri);

        document.setContent(checksum, text);

        this.contentProvider.fireDidChange(document.uri);
    }

    private async closeDocument(uri: vscode.Uri) {
        const document = await this.findDocument(uri);

        if (document) {
            this.logger.logTrace(`Removing '${document.uri}' from the document manager.`);

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

        // No checksum, just give them the latest document and hope they know what to do with it.

        await vscode.workspace.openTextDocument(document.uri);

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
