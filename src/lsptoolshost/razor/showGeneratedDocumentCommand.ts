/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLanguage } from '../../razor/src/razorLanguage';
import { getUriPath } from '../../razor/src/uriPaths';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { DocumentContentsRequest } from './documentContentsRequest';
import { CancellationToken, RequestType, TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { UriConverter } from '../utils/uriConverter';
import { GeneratedDocumentKind } from './generatedDocumentKind';

export class ShowGeneratedDocumentCommand {
    private static requestType = new RequestType<DocumentContentsRequest, string, void>(
        'razor/generatedDocumentContents'
    );

    public static register(roslynLanguageServer: RoslynLanguageServer) {
        return vscode.Disposable.from(
            vscode.commands.registerCommand('extension.showRazorCSharpWindow', async () =>
                this.show(roslynLanguageServer, GeneratedDocumentKind.CSharp, '.g.cs')
            ),
            vscode.commands.registerCommand('extension.showRazorHtmlWindow', async () =>
                this.show(roslynLanguageServer, GeneratedDocumentKind.Html, '.g.html')
            )
        );
    }

    private static async show(
        roslynLanguageServer: RoslynLanguageServer,
        kind: GeneratedDocumentKind,
        extension: string
    ) {
        const uri = await this.getActiveDocumentUri();
        if (!uri) {
            return;
        }

        const title = `${getUriPath(uri)}${extension}`;
        const panel = vscode.window.createWebviewPanel('razorGeneratedDocument', title, vscode.ViewColumn.Two, {
            enableScripts: false,
            // Disallow any remote sources
            localResourceRoots: [],
        });

        const content = await this.getGeneratedDocumentContent(uri, kind, roslynLanguageServer);

        panel.webview.html = await this.getWebViewContent(content, title);
    }

    private static async getActiveDocumentUri() {
        if (!vscode.window.activeTextEditor) {
            return null;
        }

        if (vscode.window.activeTextEditor.document.languageId !== RazorLanguage.id) {
            return null;
        }

        return vscode.window.activeTextEditor.document.uri;
    }

    public static async getGeneratedDocumentContent(
        uri: vscode.Uri,
        kind: GeneratedDocumentKind,
        roslynLanguageServer: RoslynLanguageServer
    ) {
        return roslynLanguageServer.sendRequest(
            ShowGeneratedDocumentCommand.requestType,
            new DocumentContentsRequest(TextDocumentIdentifier.create(UriConverter.serialize(uri)), kind),
            CancellationToken.None
        );
    }

    private static async getWebViewContent(content: string, title: string) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body>
    <pre>${content.replace(/</g, '&lt;').replace(/</g, '&gt;')}</pre>
</body>
</html>`;
    }
}
