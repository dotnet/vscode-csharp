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
import { getUninstalledCopilotLspConfigContent, getUpdatedCopilotLspConfigContent } from './copilotLspConfig';

const installCopilotLspCommand = 'dotnet.installCopilotLsp';
const uninstallCopilotLspCommand = 'dotnet.uninstallCopilotLsp';
const packagedCopilotLspConfigPath = path.join('redist', 'lsp-config.json');

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
        vscode.commands.registerCommand(installCopilotLspCommand, async () => {
            const lspConfigPath = path.join(os.homedir(), '.copilot', 'lsp-config.json');
            const extensionLspConfigPath = path.join(context.extension.extensionPath, packagedCopilotLspConfigPath);
            let packagedContent: string;
            try {
                packagedContent = await fs.readFile(extensionLspConfigPath, 'utf8');
            } catch (error) {
                const nodeError = error as NodeJS.ErrnoException;
                void vscode.window.showErrorMessage(
                    vscode.l10n.t('Failed to read packaged Copilot LSP config: {0}', nodeError.message)
                );
                return;
            }
            let currentContent: string | undefined;

            try {
                currentContent = await fs.readFile(lspConfigPath, 'utf8');
            } catch (error) {
                const nodeError = error as NodeJS.ErrnoException;
                if (nodeError.code !== 'ENOENT') {
                    void vscode.window.showErrorMessage(
                        vscode.l10n.t('Failed to read Copilot LSP config: {0}', nodeError.message)
                    );
                    return;
                }
            }

            let updateResult: { shouldWrite: boolean; updatedContent?: string };
            try {
                updateResult = getUpdatedCopilotLspConfigContent(currentContent, packagedContent);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(vscode.l10n.t('Failed to update Copilot LSP config: {0}', message));
                return;
            }

            if (!updateResult.shouldWrite || !updateResult.updatedContent) {
                void vscode.window.showInformationMessage(
                    vscode.l10n.t(
                        'Copilot LSP config already contains a C# LSP mapping for .cs files. No changes were made.'
                    )
                );
                return;
            }

            try {
                await fs.mkdir(path.dirname(lspConfigPath), { recursive: true });
                await fs.writeFile(lspConfigPath, updateResult.updatedContent, 'utf8');
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
    context.subscriptions.push(
        vscode.commands.registerCommand(uninstallCopilotLspCommand, async () => {
            const lspConfigPath = path.join(os.homedir(), '.copilot', 'lsp-config.json');

            let currentContent: string | undefined;
            try {
                currentContent = await fs.readFile(lspConfigPath, 'utf8');
            } catch (error) {
                const nodeError = error as NodeJS.ErrnoException;
                if (nodeError.code !== 'ENOENT') {
                    void vscode.window.showErrorMessage(
                        vscode.l10n.t('Failed to read Copilot LSP config: {0}', nodeError.message)
                    );
                    return;
                }
            }

            let uninstallResult: { shouldWrite: boolean; updatedContent?: string };
            try {
                uninstallResult = getUninstalledCopilotLspConfigContent(currentContent);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(
                    vscode.l10n.t('Failed to uninstall Copilot LSP config: {0}', message)
                );
                return;
            }

            if (!uninstallResult.shouldWrite || !uninstallResult.updatedContent) {
                void vscode.window.showInformationMessage(
                    vscode.l10n.t(
                        'Copilot LSP config does not contain a C# LSP mapping for .cs files. No changes were made.'
                    )
                );
                return;
            }

            try {
                await fs.writeFile(lspConfigPath, uninstallResult.updatedContent, 'utf8');
                void vscode.window.showInformationMessage(
                    vscode.l10n.t(
                        'Removed C# LSP mapping(s) for .cs files from Copilot LSP config at {0}.',
                        lspConfigPath
                    )
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
