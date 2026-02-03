/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import archiver from 'archiver';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel, LogMessage } from './observableLogOutputChannel';
import { commonOptions, languageServerOptions, razorOptions } from '../../shared/options';

/**
 * Registers the command to capture C# log output.
 */
export function registerCaptureLogsCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.captureLogs', async () => {
            await captureLogsToZip(context, languageServer, outputChannel, traceChannel);
        })
    );
}

async function captureLogsToZip(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): Promise<void> {
    // Arrays to collect log messages during capture
    const csharpLogMessages: LogMessage[] = [];
    const traceLogMessages: LogMessage[] = [];

    // Subscribe to log messages
    const csharpLogSubscription = outputChannel.onMessageLogged((message) => {
        csharpLogMessages.push(message);
    });
    const traceLogSubscription = traceChannel.onMessageLogged((message) => {
        traceLogMessages.push(message);
    });

    // Set log levels to Trace for capture and get the restore function
    const restoreLogLevels = await languageServer.setLogLevelsForCapture();

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('Capturing C# Logs'),
                cancellable: true,
            },
            async (progress, token) => {
                progress.report({
                    message: vscode.l10n.t('Recording logs... Click Cancel to stop and save.'),
                });

                // Wait for the user to cancel the progress
                await waitForCancellation(token);

                progress.report({
                    message: vscode.l10n.t('Creating log archive...'),
                });

                // Convert captured messages to log content
                const csharpLogContent = formatLogMessages(csharpLogMessages);
                const traceLogContent = formatLogMessages(traceLogMessages);

                // Prompt user for save location
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: getDefaultSaveUri(),
                    filters: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'Zip files': ['zip'],
                    },
                    saveLabel: vscode.l10n.t('Save Logs'),
                    title: vscode.l10n.t('Save C# Logs'),
                });

                if (!saveUri) {
                    // User cancelled the save dialog
                    return;
                }

                try {
                    await createZipWithLogs(
                        context,
                        outputChannel,
                        traceChannel,
                        csharpLogContent,
                        traceLogContent,
                        saveUri.fsPath
                    );
                    const openFolder = vscode.l10n.t('Open Folder');
                    const result = await vscode.window.showInformationMessage(
                        vscode.l10n.t('C# logs saved successfully.'),
                        openFolder
                    );
                    if (result === openFolder) {
                        await vscode.commands.executeCommand('revealFileInOS', saveUri);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    await vscode.window.showErrorMessage(
                        vscode.l10n.t({
                            message: 'Failed to save C# logs: {0}',
                            args: [errorMessage],
                            comment: ['{0} is the error message'],
                        })
                    );
                }
            }
        );
    } finally {
        // Always clean up subscriptions and restore log levels
        csharpLogSubscription.dispose();
        traceLogSubscription.dispose();
        await restoreLogLevels();
    }
}

/**
 * Formats an array of log messages into a string suitable for a log file.
 */
function formatLogMessages(messages: LogMessage[]): string {
    return messages
        .map((msg) => {
            const timestamp = msg.timestamp.toISOString();
            const level = msg.level.toUpperCase().padEnd(5);
            return `[${timestamp}] [${level}] ${msg.message}`;
        })
        .join('\n');
}

/**
 * Waits for the cancellation token to be triggered.
 */
async function waitForCancellation(token: vscode.CancellationToken): Promise<void> {
    return new Promise<void>((resolve) => {
        if (token.isCancellationRequested) {
            resolve();
            return;
        }

        const disposable = token.onCancellationRequested(() => {
            disposable.dispose();
            resolve();
        });
    });
}

/**
 * Creates a zip file containing the log contents.
 * Includes both the captured activity logs and the existing log files from the extension context.
 */
async function createZipWithLogs(
    context: vscode.ExtensionContext,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    csharpActivityLogContent: string,
    traceActivityLogContent: string,
    outputPath: string
): Promise<void> {
    // Read existing log files from disk
    const csharpLogPath = vscode.Uri.joinPath(context.logUri, outputChannel.name + '.log');
    const traceLogPath = vscode.Uri.joinPath(context.logUri, traceChannel.name + '.log');

    const csharpLogContent = await readLogFileContent(csharpLogPath);
    const traceLogContent = await readLogFileContent(traceLogPath);

    return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 },
        });

        output.on('close', () => {
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Add existing log files to the archive
        if (csharpLogContent) {
            archive.append(csharpLogContent, { name: 'csharp.log' });
        }
        if (traceLogContent) {
            archive.append(traceLogContent, { name: 'csharp-lsp-trace.log' });
        }

        // Add captured activity logs to the archive
        archive.append(csharpActivityLogContent, { name: 'csharp.activity.log' });
        archive.append(traceActivityLogContent, { name: 'csharp-lsp-trace.activity.log' });

        // Add current settings to the archive
        const settingsContent = gatherCurrentSettings();
        archive.append(settingsContent, { name: 'csharp-settings.json' });

        void archive.finalize();
    });
}

/**
 * Reads the content of a log file, returning null if the file doesn't exist.
 */
async function readLogFileContent(logFileUri: vscode.Uri): Promise<string | null> {
    try {
        const content = await vscode.workspace.fs.readFile(logFileUri);
        return Buffer.from(content).toString('utf8');
    } catch {
        // File doesn't exist or can't be read
        return null;
    }
}

/**
 * Gathers the current settings for CommonOptions, LanguageServerOptions, and RazorOptions.
 * Returns a formatted JSON string.
 */
function gatherCurrentSettings(): string {
    const settings = {
        commonOptions: {
            waitForDebugger: commonOptions.waitForDebugger,
            serverPath: commonOptions.serverPath,
            useOmnisharpServer: commonOptions.useOmnisharpServer,
            excludePaths: commonOptions.excludePaths,
            defaultSolution: commonOptions.defaultSolution,
            unitTestDebuggingOptions: commonOptions.unitTestDebuggingOptions,
            runSettingsPath: commonOptions.runSettingsPath,
            organizeImportsOnFormat: commonOptions.organizeImportsOnFormat,
        },
        languageServerOptions: {
            documentSelector: languageServerOptions.documentSelector,
            extensionsPaths: languageServerOptions.extensionsPaths,
            preferCSharpExtension: languageServerOptions.preferCSharpExtension,
            startTimeout: languageServerOptions.startTimeout,
            crashDumpPath: languageServerOptions.crashDumpPath,
            analyzerDiagnosticScope: languageServerOptions.analyzerDiagnosticScope,
            compilerDiagnosticScope: languageServerOptions.compilerDiagnosticScope,
            componentPaths: languageServerOptions.componentPaths,
            enableXamlTools: languageServerOptions.enableXamlTools,
            suppressLspErrorToasts: languageServerOptions.suppressLspErrorToasts,
            suppressMiscellaneousFilesToasts: languageServerOptions.suppressMiscellaneousFilesToasts,
            useServerGC: languageServerOptions.useServerGC,
            reportInformationAsHint: languageServerOptions.reportInformationAsHint,
        },
        razorOptions: {
            razorDevMode: razorOptions.razorDevMode,
            razorPluginPath: razorOptions.razorPluginPath,
        },
    };
    return JSON.stringify(settings, null, 2);
}

/**
 * Gets the default URI for saving the log archive.
 * Uses the first workspace folder if available, otherwise falls back to the user's home directory.
 */
function getDefaultSaveUri(): vscode.Uri {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `csharp-logs-${timestamp}.zip`;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);
    }

    // Fallback to just the filename (system will use default location)
    return vscode.Uri.file(fileName);
}
