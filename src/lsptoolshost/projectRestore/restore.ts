/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import {
    RestorableProjects,
    RestoreParams,
    RestorePartialResult,
    RestoreRequest,
    ProjectNeedsRestoreRequest,
} from '../server/roslynProtocol';
import path from 'path';
import { showErrorMessage } from '../../shared/observers/utils/showMessage';
import { getCSharpDevKit } from '../../utils/getCSharpDevKit';

let _restoreInProgress = false;

export function registerRestoreCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    csharpOutputChannel: vscode.LogOutputChannel
) {
    // We do not need to register restore commands if using C# devkit.
    if (!getCSharpDevKit()) {
        context.subscriptions.push(
            vscode.commands.registerCommand('dotnet.restore.project', async (_request): Promise<void> => {
                return chooseProjectAndRestore(languageServer, csharpOutputChannel);
            })
        );
        context.subscriptions.push(
            vscode.commands.registerCommand('dotnet.restore.all', async (): Promise<void> => {
                return restore(languageServer, csharpOutputChannel, [], true);
            })
        );
    }

    languageServer.registerOnRequest(ProjectNeedsRestoreRequest.type, async (params) => {
        let projectFilePaths = params.projectFilePaths;
        if (getCSharpDevKit()) {
            // Only restore '.cs' files (file-based apps) if CDK is loaded.
            const csharpFiles = [];
            for (const path of projectFilePaths) {
                if (path.endsWith('.cs')) {
                    csharpFiles.push(path);
                } else {
                    csharpOutputChannel.debug(
                        `[.NET Restore] Not restoring '${path}' from C# extension, because C# Dev Kit is expected to handle restore for it.`
                    );
                }
            }

            projectFilePaths = csharpFiles;
        }

        if (projectFilePaths.length > 0) {
            await restore(languageServer, csharpOutputChannel, params.projectFilePaths, false);
        }
    });
}

async function chooseProjectAndRestore(
    languageServer: RoslynLanguageServer,
    outputChannel: vscode.LogOutputChannel
): Promise<void> {
    let projects: string[];
    try {
        projects = await languageServer.sendRequest0(
            RestorableProjects.type,
            new vscode.CancellationTokenSource().token
        );
    } catch (e) {
        if (e instanceof vscode.CancellationError) {
            return;
        }

        throw e;
    }

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

    await restore(languageServer, outputChannel, [pickedItem.description!], true);
}

export async function restore(
    languageServer: RoslynLanguageServer,
    outputChannel: vscode.LogOutputChannel,
    projectFiles: string[],
    showOutput: boolean
): Promise<void> {
    if (_restoreInProgress) {
        showErrorMessage(vscode, vscode.l10n.t('Restore already in progress'));
        return;
    }
    _restoreInProgress = true;
    if (showOutput) {
        outputChannel.show(true);
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
                        outputChannel.debug(`[.NET Restore] ${output.message}`);
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
                    (err) => outputChannel.error(`[.NET Restore] ${err}`)
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
