/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';
import { RefreshSourceGeneratorsNotification } from '../server/roslynProtocol';

export function registerSourceGeneratorRefresh(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel
) {
    // Register the explicit rerun source generators command with force regeneration.
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.rerunSourceGenerators', async () => {
            await languageServer.sendNotification(RefreshSourceGeneratorsNotification.method, {
                forceRegeneration: true,
            });
        })
    );

    // After a build task completes, refresh source generators without force regeneration.
    context.subscriptions.push(
        vscode.tasks.onDidEndTask(async (e) => {
            if (e.execution.task.group === vscode.TaskGroup.Build) {
                outputChannel.trace('Refreshing source generators on build start on build end');
                await languageServer.sendNotification(RefreshSourceGeneratorsNotification.method, {
                    forceRegeneration: false,
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.tasks.onDidStartTask(async (e) => {
            if (e.execution.task.group === vscode.TaskGroup.Build) {
                outputChannel.trace('Refreshing source generators on build start');
                await languageServer.sendNotification(RefreshSourceGeneratorsNotification.method, {
                    forceRegeneration: false,
                });
            }
        })
    );
}
