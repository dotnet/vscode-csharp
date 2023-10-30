/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as RoslynProtocol from './roslynProtocol';
import { CodeAction, CodeActionResolveRequest, LSPAny } from 'vscode-languageserver-protocol';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { URIConverter, createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { UriConverter } from './uriConverter';

export function registerNestedCodeActionCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: vscode.OutputChannel
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'roslyn.client.nestedCodeAction',
            async (request): Promise<void> => registerNestedResolveCodeAction(languageServer, request, outputChannel)
        )
    );
}

async function registerNestedResolveCodeAction(
    languageServer: RoslynLanguageServer,
    codeActionData: any,
    outputChannel: vscode.OutputChannel
) {
    if (codeActionData) {
        const data = <LSPAny>codeActionData;
        const action = data.NestedCodeAction;

        if (action && action.nestedActions && action.nestedActions.length > 0) {
            await vscode.window
                .showQuickPick(
                    action.nestedActions?.map((child: { title: string }) => child.title),
                    {
                        placeHolder: vscode.l10n.t('Pick a nested action'),
                        ignoreFocusOut: true,
                    }
                )
                .then(async (selectedValue) => {
                    if (selectedValue) {
                        const selectedAction = action.nestedActions?.find(
                            (child: { title: string }) => child.title === selectedValue
                        );
                        if (selectedAction) {
                            await vscode.window.withProgress(
                                {
                                    location: vscode.ProgressLocation.Notification,
                                    title: vscode.l10n.t('Nested Code Action'),
                                    cancellable: true,
                                },
                                async (_, token) => {
                                    let result: string | undefined;
                                    if (selectedAction.data.FixAllFlavors) {
                                        result = await vscode.window.showQuickPick(selectedAction.data.FixAllFlavors, {
                                            placeHolder: vscode.l10n.t('Pick a fix all scope'),
                                            ignoreFocusOut: true,
                                        });
                                    }
                                    let response: CodeAction;
                                    if (result) {
                                        const fixAllCodeAction: RoslynProtocol.RoslynFixAllCodeAction = {
                                            title: selectedAction.data.UniqueIdentifier,
                                            data: selectedAction.data,
                                            scope: result,
                                        };

                                        response = await languageServer.sendRequest(
                                            RoslynProtocol.CodeActionFixAllResolveRequest.type,
                                            fixAllCodeAction,
                                            token
                                        );
                                    } else {
                                        const nestedCodeActionResolve: CodeAction = {
                                            title: selectedAction.data.UniqueIdentifier,
                                            data: selectedAction.data,
                                        };

                                        response = await languageServer.sendRequest(
                                            CodeActionResolveRequest.type,
                                            nestedCodeActionResolve,
                                            token
                                        );
                                    }

                                    if (response.edit) {
                                        const uriConverter: URIConverter = (value: string): vscode.Uri =>
                                            UriConverter.deserialize(value);
                                        const protocolConverter = createConverter(uriConverter, true, true);
                                        const fixAllEdit = await protocolConverter.asWorkspaceEdit(response.edit);
                                        if (!(await vscode.workspace.applyEdit(fixAllEdit))) {
                                            if (result) {
                                                const componentName = '[roslyn.client.fixAllCodeAction]';
                                                const errorMessage = 'Failed to make a fix all edit for completion.';
                                                outputChannel.show();
                                                outputChannel.appendLine(`${componentName} ${errorMessage}`);
                                                throw new Error(
                                                    'Tried to insert multiple code action edits, but an error occurred.'
                                                );
                                            } else {
                                                const componentName = '[roslyn.client.nestedCodeAction]';
                                                const errorMessage = 'Failed to make am edit for completion.';
                                                outputChannel.show();
                                                outputChannel.appendLine(`${componentName} ${errorMessage}`);
                                                throw new Error(
                                                    'Tried to insert code action edit, but an error occurred.'
                                                );
                                            }
                                        }
                                    }
                                }
                            );
                        }
                    }
                });
        }
    }
}
