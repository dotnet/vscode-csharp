/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as RoslynProtocol from './roslynProtocol';
import { LSPAny } from 'vscode-languageserver-protocol';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { URIConverter, createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { UriConverter } from './uriConverter';

export function registerCodeActionFixAllCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'roslyn.client.fixAllCodeAction',
            async (request): Promise<void> => registerFixAllResolveCodeAction(languageServer, request)
        )
    );
}

async function registerFixAllResolveCodeAction(languageServer: RoslynLanguageServer, codeActionData: any) {
    if (codeActionData) {
        const data = <LSPAny>codeActionData;
        const result = await vscode.window.showQuickPick(data.FixAllFlavors, {
            placeHolder: vscode.l10n.t('Pick a fix all scope'),
        });

        let fixAllEdit = new vscode.WorkspaceEdit();
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Fix All Code Action',
                cancellable: true,
            },
            async (_, token) => {
                if (result) {
                    const fixAllCodeAction: RoslynProtocol.RoslynFixAllCodeAction = {
                        title: data.UniqueIdentifier,
                        data: data,
                        scope: result,
                    };

                    const response = await languageServer.sendRequest(
                        RoslynProtocol.CodeActionFixAllResolveRequest.type,
                        fixAllCodeAction,
                        token
                    );

                    if (response.edit) {
                        const uriConverter: URIConverter = (value: string): vscode.Uri =>
                            UriConverter.deserialize(value);
                        const protocolConverter = createConverter(uriConverter, true, true);
                        fixAllEdit = await protocolConverter.asWorkspaceEdit(response.edit);
                    }
                }
            }
        );

        if (!(await vscode.workspace.applyEdit(fixAllEdit))) {
            throw new Error('Tried to insert multiple code action edits, but an error occurred.');
        }
    }
}
