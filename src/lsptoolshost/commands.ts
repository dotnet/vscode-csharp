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
import {
    changeProjectContext,
    changeProjectContextCommandName,
    changeProjectContextEditor,
    changeProjectContextFileExplorer,
    openAndChangeProjectContext,
} from './projectContext/projectContextCommands';
import TelemetryReporter from '@vscode/extension-telemetry';
import { TelemetryEventNames } from '../shared/telemetryEventNames';
import { registerCollectLogsCommand } from './logging/collectLogs';
import { ObservableLogOutputChannel } from './logging/observableLogOutputChannel';
import { RazorLogger } from '../razor/src/razorLogger';

export function registerCommands(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    hostExecutableResolver: IHostExecutableResolver,
    outputChannel: ObservableLogOutputChannel,
    csharpTraceChannel: ObservableLogOutputChannel,
    reporter: TelemetryReporter,
    razorLogger: RazorLogger
) {
    registerExtensionCommands(
        context,
        languageServer,
        hostExecutableResolver,
        outputChannel,
        csharpTraceChannel,
        reporter,
        razorLogger
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
    reporter: TelemetryReporter,
    razorLogger: RazorLogger
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
    registerCollectLogsCommand(context, languageServer, outputChannel, csharpTraceChannel, razorLogger);
}
