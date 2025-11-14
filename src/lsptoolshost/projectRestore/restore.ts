/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { RestorableProjects, RestoreParams, RestoreRequest } from '../server/roslynProtocol';
import path from 'path';
import { showErrorMessage } from '../../shared/observers/utils/showMessage';
import { getCSharpDevKit } from '../../utils/getCSharpDevKit';
import { CancellationToken } from 'vscode-jsonrpc';

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
                return restore(languageServer, csharpOutputChannel, []);
            })
        );
    }
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

    await restore(languageServer, outputChannel, [pickedItem.description!]);
}

export async function restore(
    languageServer: RoslynLanguageServer,
    outputChannel: vscode.LogOutputChannel,
    projectFiles: string[]
): Promise<void> {
    if (_restoreInProgress) {
        showErrorMessage(vscode, vscode.l10n.t('Restore already in progress'));
        return;
    }
    _restoreInProgress = true;
    outputChannel.show(true);

    const request: RestoreParams = { projectFilePaths: projectFiles };

    // server will show a work done progress with cancellation.  no need to pass a token to the request.
    const resultPromise = languageServer.sendRequest(RestoreRequest.type, request, CancellationToken.None).then(
        () => {
            _restoreInProgress = false;
        },
        (err) => {
            outputChannel.error(`[.NET Restore] ${err}`);
            _restoreInProgress = false;
        }
    );

    await resultPromise;
    return;
}
