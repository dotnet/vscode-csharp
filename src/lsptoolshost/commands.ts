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

export function registerCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    hostExecutableResolver: IHostExecutableResolver,
    outputChannel: vscode.LogOutputChannel
) {
    registerExtensionCommands(context, languageServer, hostExecutableResolver, outputChannel);
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
    outputChannel: vscode.LogOutputChannel
) {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.reportIssue', async () =>
            reportIssue(
                context.extension.packageJSON.version,
                getDotnetInfo,
                /*shouldIncludeMonoInfo:*/ false,
                hostExecutableResolver
            )
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.showOutputWindow', async () => outputChannel.show())
    );
}
