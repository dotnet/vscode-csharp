/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel } from './observableLogOutputChannel';
import { createZipWithLogs, getDefaultSaveUri, RazorLogObserver } from './loggingUtils';
import { RazorLogger } from '../../razor/src/razorLogger';

/**
 * Registers the command to capture C# log output.
 */
export function registerCaptureLogsCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    razorLogger: RazorLogger
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.captureLogs', async () => {
            await captureLogsToZip(context, languageServer, outputChannel, traceChannel, razorLogger);
        })
    );
}

async function captureLogsToZip(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    razorLogger: RazorLogger
): Promise<void> {
    // Create observers to collect log messages during capture
    const csharpLogObserver = outputChannel.observe();
    const traceLogObserver = traceChannel.observe();
    const razorLogObserver = new RazorLogObserver(razorLogger);

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
                const razorLogContent = razorLogObserver.getLog();

                // Prompt user for save location
                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: getDefaultSaveUri(),
                    filters: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'Zip files': ['zip'],
                    },
                    saveLabel: vscode.l10n.t('Save Logs'),
                    title: vscode.l10n.t('Save Logs'),
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
                        razorLogger,
                        csharpLogContent,
                        traceLogContent,
                        razorLogContent,
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
