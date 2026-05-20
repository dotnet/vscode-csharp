/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
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

const configureCopilotLspCommand = 'dotnet.configureCopilotLsp';
const packagedCopilotLspConfigPath = path.join('copilot', 'lsp-config.json');

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
    context.subscriptions.push(
        vscode.commands.registerCommand(configureCopilotLspCommand, async () => {
            const lspConfigPath = path.join(os.homedir(), '.copilot', 'lsp-config.json');
            const extensionLspConfigPath = path.join(context.extension.extensionPath, packagedCopilotLspConfigPath);

            let csharpLspServerConfig: unknown;
            try {
                const extensionLspConfigContent = await fs.readFile(extensionLspConfigPath, 'utf8');
                const extensionLspConfig = JSON.parse(extensionLspConfigContent) as {
                    lspServers?: { [key: string]: unknown };
                };
                csharpLspServerConfig = extensionLspConfig.lspServers?.csharp;

                if (!csharpLspServerConfig || typeof csharpLspServerConfig !== 'object') {
                    void vscode.window.showErrorMessage(
                        vscode.l10n.t('Packaged Copilot LSP config is missing lspServers.csharp.')
                    );
                    return;
                }
            } catch (error) {
                const nodeError = error as NodeJS.ErrnoException;
                void vscode.window.showErrorMessage(
                    vscode.l10n.t('Failed to read packaged Copilot LSP config: {0}', nodeError.message)
                );
                return;
            }

            let lspConfig: { lspServers?: { [key: string]: unknown } } = {};

            try {
                const currentContent = await fs.readFile(lspConfigPath, 'utf8');
                lspConfig = JSON.parse(currentContent);
            } catch (error) {
                const nodeError = error as NodeJS.ErrnoException;
                if (nodeError.code !== 'ENOENT') {
                    void vscode.window.showErrorMessage(
                        vscode.l10n.t('Failed to read Copilot LSP config: {0}', nodeError.message)
                    );
                    return;
                }
            }

            if (!lspConfig.lspServers || typeof lspConfig.lspServers !== 'object') {
                lspConfig.lspServers = {};
            }

            lspConfig.lspServers.csharp = csharpLspServerConfig;

            try {
                await fs.writeFile(lspConfigPath, `${JSON.stringify(lspConfig, null, 2)}\n`, 'utf8');
                void vscode.window.showInformationMessage(
                    vscode.l10n.t('Updated Copilot LSP config at {0}.', lspConfigPath)
                );
            } catch (error) {
                const nodeError = error as NodeJS.ErrnoException;
                void vscode.window.showErrorMessage(
                    vscode.l10n.t('Failed to write Copilot LSP config: {0}', nodeError.message)
                );
            }
        })
    );
    registerCollectLogsCommand(context, languageServer, outputChannel, csharpTraceChannel, razorLogger);
}
