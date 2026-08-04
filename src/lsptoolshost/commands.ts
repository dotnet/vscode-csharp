/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from './server/roslynLanguageServer.js';
import reportIssue from '../shared/reportIssue.js';
import { getDotnetInfo } from '../shared/utils/getDotnetInfo.js';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver.js';
import { registerWorkspaceCommands } from './workspace/workspaceCommands.js';
import { registerServerCommands } from './server/serverCommands.js';
import {
    changeProjectContext,
    changeProjectContextCommandName,
    changeProjectContextEditor,
    changeProjectContextFileExplorer,
    openAndChangeProjectContext,
} from './projectContext/projectContextCommands.js';
import { ITelemetryReporter } from '../shared/telemetryReporter.js';
import { TelemetryEventNames } from '../shared/telemetryEventNames.js';
import { registerCollectLogsCommand } from './logging/collectLogs.js';
import { ObservableLogOutputChannel } from './logging/observableLogOutputChannel.js';

export function registerCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    hostExecutableResolver: IHostExecutableResolver,
    outputChannel: ObservableLogOutputChannel,
    csharpTraceChannel: ObservableLogOutputChannel,
    reporter: ITelemetryReporter
) {
    registerExtensionCommands(
        context,
        languageServer,
        hostExecutableResolver,
        outputChannel,
        csharpTraceChannel,
        reporter
    );
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
    outputChannel: ObservableLogOutputChannel,
    csharpTraceChannel: ObservableLogOutputChannel,
    reporter: ITelemetryReporter
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            changeProjectContextCommandName,
            async (document: vscode.TextDocument | undefined, options) => {
                reporter.sendTelemetryEvent(TelemetryEventNames.ProjectContextChangeCommand);
                await changeProjectContext(languageServer, document, options);
            }
        )
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(changeProjectContextFileExplorer, async (uri) => {
            reporter.sendTelemetryEvent(TelemetryEventNames.ProjectContextChangeFileExplorer);
            await openAndChangeProjectContext(languageServer, uri);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(changeProjectContextEditor, async (uri) => {
            reporter.sendTelemetryEvent(TelemetryEventNames.ProjectContextChangeEditor);
            await openAndChangeProjectContext(languageServer, uri);
        })
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
    registerCollectLogsCommand(context, languageServer, outputChannel, csharpTraceChannel);
}
