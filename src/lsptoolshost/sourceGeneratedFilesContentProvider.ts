/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as RoslynProtocol from './roslynProtocol';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { UriConverter } from './uriConverter';
import * as lsp from 'vscode-languageserver-protocol';

export function registerSourceGeneratedFilesContentProvider(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer
) {
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            'roslyn-source-generated',
            new (class implements vscode.TextDocumentContentProvider {
                async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
                    const result = await languageServer.sendRequest(
                        RoslynProtocol.SourceGeneratorGetTextRequest.type,
                        { textDocument: lsp.TextDocumentIdentifier.create(UriConverter.serialize(uri)) },
                        token
                    );
                    return result.text;
                }
            })()
        )
    );
}
