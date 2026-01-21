/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from './server/roslynLanguageServer';
import reportIssue from '../shared/reportIssue';
import { getDotnetInfo } from '../shared/utils/getDotnetInfo';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { registerWorkspaceCommands } from './workspace/workspaceCommands';
import { registerServerCommands } from './server/serverCommands';
import { CancellationToken } from 'vscode-languageclient/node';
import { VSProjectContext } from './server/roslynProtocol';

export function registerCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    hostExecutableResolver: IHostExecutableResolver,
    outputChannel: vscode.LogOutputChannel,
    csharpTraceChannel: vscode.LogOutputChannel
) {
    registerExtensionCommands(context, languageServer, hostExecutableResolver, outputChannel, csharpTraceChannel);
    registerWorkspaceCommands(context, languageServer);
    registerServerCommands(context, languageServer, outputChannel);
}

/**
 * Register commands that drive the C# extension.
 */
function registerExtensionCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    hostExecutableResolver: IHostExecutableResolver,
    outputChannel: vscode.LogOutputChannel,
    csharpTraceChannel: vscode.LogOutputChannel
) {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.changeProjectContext', async (document, options) =>
            changeProjectContext(languageServer, document, options)
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.reportIssue', async () =>
            reportIssue(
                context,
                getDotnetInfo,
                /*shouldIncludeMonoInfo:*/ false,
                [outputChannel, csharpTraceChannel],
                hostExecutableResolver
            )
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.showOutputWindow', async () => outputChannel.show())
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.openUrlInBrowser', async () => {
            await vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/new-csharp-commands'));
        })
    );
}
async function changeProjectContext(
    languageServer: RoslynLanguageServer,
    document: vscode.TextDocument,
    options: ChangeProjectContextOptions
): Promise<VSProjectContext | undefined> {
    const contextList = await languageServer._projectContextService.queryServerProjectContexts(
        document.uri,
        CancellationToken.None
    );
    if (contextList === undefined) {
        return;
    }

    let context: VSProjectContext | undefined = undefined;

    if (options !== undefined) {
        const contextLabel = `${options.projectName} (${options.tfm})`;
        context =
            contextList._vs_projectContexts.find((context) => context._vs_label === contextLabel) ||
            contextList._vs_projectContexts.find((context) => context._vs_label === options.projectName);
    } else {
        const items = contextList._vs_projectContexts
            .map((context) => {
                return { label: context._vs_label, context };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t('Select project context'),
        });
        context = selectedItem?.context;
    }

    if (context === undefined) {
        return;
    }

    await languageServer._projectContextService.setActiveFileContext(document, contextList, context);
}

interface ChangeProjectContextOptions {
    projectName: string;
    tfm: string;
}
