/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from './roslynLanguageServer';
import {
    RestorableProjects,
    RestoreParams,
    RestorePartialResult,
    RestoreRequest,
    UnresolvedProjectDependenciesNotification,
} from './roslynProtocol';
import path = require('path');

let _restoreInProgress = false;

export function registerRestoreCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    restoreChannel: vscode.OutputChannel
) {
    context.subscriptions.push(
        vscode.commands.registerCommand('dotnet.restore.project', async (_request): Promise<void> => {
            return chooseProjectAndRestore(languageServer, restoreChannel);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('dotnet.restore.all', async (): Promise<void> => {
            return restore(languageServer, restoreChannel, [], true);
        })
    );

    languageServer.registerOnRequest(UnresolvedProjectDependenciesNotification.type, async (params) => {
        await restore(languageServer, restoreChannel, params.projectFilePaths, false);
    });
}

async function chooseProjectAndRestore(
    languageServer: RoslynLanguageServer,
    restoreChannel: vscode.OutputChannel
): Promise<void> {
    const projects = await languageServer.sendRequest0(
        RestorableProjects.type,
        new vscode.CancellationTokenSource().token
    );

    const items = projects.map((p) => {
        const projectName = path.basename(p);
        const item: vscode.QuickPickItem = {
            label: vscode.l10n.t(`Restore {0}`, projectName),
            description: p,
        };
        return item;
    });

    const pickedItem = await vscode.window.showQuickPick(items);
    if (!pickedItem) {
        return;
    }

    await restore(languageServer, restoreChannel, [pickedItem.description!], true);
}

export async function restore(
    languageServer: RoslynLanguageServer,
    restoreChannel: vscode.OutputChannel,
    projectFiles: string[],
    showOutput: boolean
): Promise<void> {
    if (_restoreInProgress) {
        vscode.window.showErrorMessage(vscode.l10n.t('Restore already in progress'));
        return;
    }
    _restoreInProgress = true;
    if (showOutput) {
        restoreChannel.show(true);
    }

    const request: RestoreParams = { projectFilePaths: projectFiles };
    await vscode.window
        .withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('Restore'),
                cancellable: true,
            },
            async (progress, token) => {
                const writeOutput = (output: RestorePartialResult) => {
                    if (output.message) {
                        restoreChannel.appendLine(output.message);
                    }

                    progress.report({ message: output.stage });
                };

                progress.report({ message: vscode.l10n.t('Sending request') });
                const responsePromise = languageServer.sendRequestWithProgress(
                    RestoreRequest.type,
                    request,
                    async (p) => writeOutput(p),
                    token
                );

                await responsePromise.then(
                    (result) => result.forEach((r) => writeOutput(r)),
                    (err) => restoreChannel.appendLine(err)
                );
            }
        )
        .then(
            () => {
                _restoreInProgress = false;
            },
            () => {
                _restoreInProgress = false;
            }
        );

    return;
}
