/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CodeAction, CodeActionResolveRequest, LSPAny } from 'vscode-languageserver-protocol';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { URIConverter, createConverter } from 'vscode-languageclient/lib/common/protocolConverter';
import { UriConverter } from './uriConverter';
import { getFixAllResponse } from './fixAllCodeAction';

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
): Promise<void> {
    if (codeActionData) {
        const data = <LSPAny>codeActionData;
        const action = data.NestedCodeAction;

        if (action?.nestedActions?.length > 0) {
            const codeActionTitles: string[] = getCodeActionTitles(action.nestedActions);
            const selectedValue = await vscode.window.showQuickPick(codeActionTitles, {
                placeHolder: vscode.l10n.t(action.title),
                ignoreFocusOut: true,
            });
            if (selectedValue) {
                const selectedAction = retrieveSelectedAction(selectedValue, action.nestedActions);

                if (!selectedAction) {
                    return;
                }

                if (selectedAction.data.FixAllFlavors) {
                    await getFixAllResponse(selectedAction.data, languageServer, outputChannel);
                    return;
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: vscode.l10n.t('Nested Code Action'),
                        cancellable: true,
                    },
                    async (_, token) => {
                        const nestedCodeActionResolve: CodeAction = {
                            title: selectedAction.title,
                            data: selectedAction.data,
                        };

                        const response = await languageServer.sendRequest(
                            CodeActionResolveRequest.type,
                            nestedCodeActionResolve,
                            token
                        );

                        if (!response.edit) {
                            outputChannel.show();
                            outputChannel.appendLine(`Failed to make an edit for completion.`);
                            return;
                        }

                        const uriConverter: URIConverter = (value: string): vscode.Uri =>
                            UriConverter.deserialize(value);
                        const protocolConverter = createConverter(uriConverter, true, true);
                        const fixAllEdit = await protocolConverter.asWorkspaceEdit(response.edit);
                        if (!(await vscode.workspace.applyEdit(fixAllEdit))) {
                            const componentName = '[roslyn.client.nestedCodeAction]';
                            const errorMessage = 'Failed to make am edit for completion.';
                            outputChannel.show();
                            outputChannel.appendLine(`${componentName} ${errorMessage}`);
                            throw new Error('Tried to insert code action edit, but an error occurred.');
                        }
                    }
                );
            }
        }
    }
}

function getCodeActionTitles(nestedActions: any): string[] {
    // Flatten the array of strings and concatenate with " ->"
    return nestedActions.flatMap(
        (nestedAction: {
            data: {
                FixAllFlavors: string[] | null;
                CodeActionPath: string[];
            };
        }) => {
            const codeActionPath = nestedAction.data.CodeActionPath;
            const fixAllFlavors = nestedAction.data.FixAllFlavors;
            // If there's only one string, return it directly
            if (codeActionPath.length === 1) {
                return codeActionPath;
            }

            // Concatenate multiple strings with " ->"
            const concatenatedString = codeActionPath.slice(1).join(' -> ');
            const fixAllString = vscode.l10n.t('Fix All: ');
            return fixAllFlavors ? [`${fixAllString}${concatenatedString}`] : concatenatedString;
        }
    );
}

function retrieveSelectedAction(selectedValue: string, nestedActions: any): any {
    return nestedActions.find(
        (nestedAction: { data: { CodeActionPath: string[]; FixAllFlavors: string[] | null } }) => {
            const codeActionPath = nestedAction.data.CodeActionPath;
            const fixAllFlavors = nestedAction.data.FixAllFlavors;
            const fixAllString = vscode.l10n.t('Fix All: ');
            const concatenatedString = codeActionPath.slice(1).join(' -> ');
            return fixAllFlavors
                ? `${fixAllString}${concatenatedString}` === selectedValue
                : concatenatedString === selectedValue;
        }
    );
}
