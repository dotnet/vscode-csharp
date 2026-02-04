/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel } from './observableLogOutputChannel';
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
    // Create observers to collect log messages during capture
    const csharpLogObserver = outputChannel.observe();
    const traceLogObserver = traceChannel.observe();

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
                    message: vscode.l10n.t('Creating archive...'),
                });

                // Get formatted log content from observers
                const csharpLogContent = csharpLogObserver.getLog();
                const traceLogContent = traceLogObserver.getLog();

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
        // Always clean up observers and restore log levels
        csharpLogObserver.dispose();
        traceLogObserver.dispose();
        await restoreLogLevels();
    }
}

/**
 * Waits for the cancellation token to be triggered.
 */
export async function waitForCancellation(token: vscode.CancellationToken): Promise<void> {
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
 * Creates a zip file containing the log contents and optionally a trace file.
 * Includes both the captured activity logs and the existing log files from the extension context.
 */
export async function createZipWithLogs(
    context: vscode.ExtensionContext,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    csharpActivityLogContent: string,
    traceActivityLogContent: string,
    outputPath: string,
    traceFilePath?: string
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
            // Clean up the trace file after adding to archive
            if (traceFilePath && fs.existsSync(traceFilePath)) {
                try {
                    fs.unlinkSync(traceFilePath);
                } catch {
                    // Ignore cleanup errors
                }
            }
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Add trace file to the archive if it exists
        if (traceFilePath && fs.existsSync(traceFilePath)) {
            archive.file(traceFilePath, { name: path.basename(traceFilePath) });
        }

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
export async function readLogFileContent(logFileUri: vscode.Uri): Promise<string | null> {
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
export function gatherCurrentSettings(): string {
    const settings = {
        commonOptions: getOptionValues(commonOptions),
        languageServerOptions: getOptionValues(languageServerOptions),
        razorOptions: getOptionValues(razorOptions),
    };
    return JSON.stringify(settings, null, 2);
}

/**
 * Extracts all option values from an options object by iterating over its property descriptors.
 *
 * Note: We cannot use Object.keys() here because the options objects are class instances where
 * all properties are defined as getters on the prototype, not as own properties on the instance.
 * Object.keys() only returns enumerable own properties, so it would return an empty array.
 * Instead, we inspect the prototype's property descriptors to find all the getter functions.
 */
function getOptionValues<T extends object>(options: T): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const prototype = Object.getPrototypeOf(options);
    const descriptors = Object.getOwnPropertyDescriptors(prototype);

    for (const [key, descriptor] of Object.entries(descriptors)) {
        // Skip constructor and non-getter properties
        if (key === 'constructor' || typeof descriptor.get !== 'function') {
            continue;
        }
        result[key] = (options as Record<string, unknown>)[key];
    }

    return result;
}

/**
 * Gets the default URI for saving the log/trace archive.
 * Uses the first workspace folder if available, otherwise falls back to the user's home directory.
 */
export function getDefaultSaveUri(filePrefix: string = 'csharp-logs'): vscode.Uri {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `${filePrefix}-${timestamp}.zip`;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return vscode.Uri.joinPath(workspaceFolders[0].uri, fileName);
    }

    // Fallback to just the filename (system will use default location)
    return vscode.Uri.file(fileName);
}
