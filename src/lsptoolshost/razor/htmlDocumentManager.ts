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

export class HtmlDocumentManager {
    private readonly htmlDocuments: { [hostDocumentPath: string]: HtmlDocument } = {};
    private readonly contentProvider: HtmlDocumentContentProvider;

    constructor(private readonly platformInfo: PlatformInformation, private readonly logger: RazorLogger) {
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

                // TODO: Send a notification back to the server so it can cancel any pending sync requests and clear its cache.
            }
        });

        const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
            HtmlDocumentContentProvider.scheme,
            this.contentProvider
        );

        return vscode.Disposable.from(didCloseRegistration, providerRegistration);
    }

    public async updateDocumentText(uri: vscode.Uri, text: string) {
        const document = await this.getDocument(uri);

        this.logger.logTrace(`New content for '${uri}', updating '${document.path}'.`);

        document.setContent(text);

        this.contentProvider.fireDidChange(document.uri);
    }

    private async closeDocument(uri: vscode.Uri) {
        const document = await this.findDocument(uri);

        if (document) {
            this.logger.logTrace(`Removing '${document.uri}' from the document manager.`);

            delete this.htmlDocuments[document.path];
        }
    }

    public async getDocument(uri: vscode.Uri): Promise<HtmlDocument> {
        let document = this.findDocument(uri);

        // This might happen in the case that a file is opened outside the workspace
        if (!document) {
            this.logger.logInfo(
                `File '${uri}' didn't exist in the Razor document list. This is likely because it's from outside the workspace.`
            );
            document = this.addDocument(uri);
        }

        await vscode.workspace.openTextDocument(document.uri);

        return document!;
    }

    private addDocument(uri: vscode.Uri): HtmlDocument {
        let document = this.findDocument(uri);
        if (document) {
            this.logger.logInfo(`Skipping document creation for '${document.path}' because it already exists.`);
            return document;
        }

        document = this.createDocument(uri);
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

    private createDocument(uri: vscode.Uri) {
        uri = uri.with({
            scheme: HtmlDocumentContentProvider.scheme,
            path: `${uri.path}${virtualHtmlSuffix}`,
        });
        const projectedDocument = new HtmlDocument(uri);

        return projectedDocument;
    }
}
