/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel } from './observableLogOutputChannel';
import {
    DumpRequest,
    collectDumps,
    createZipWithLogs,
    getDefaultSaveUri,
    selectDumpsWithArguments,
    verifyDumpTools,
} from './loggingUtils';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';

export function registerDumpCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.collectDump', async () => {
            const processId = languageServer.processId;
            if (!processId) {
                showErrorMessageWithOptions(
                    vscode,
                    vscode.l10n.t('Language server process not found, ensure the server is running.'),
                    { modal: true }
                );
                return;
            }

            // Step 1: Let the user select dump type(s) and provide arguments
            const dumpRequests = await selectDumpsWithArguments({
                title: vscode.l10n.t('Select Dump Type'),
                placeHolder: vscode.l10n.t('Choose dump type(s) to collect'),
                processId,
            });
            if (!dumpRequests || dumpRequests.length === 0) {
                return; // User cancelled
            }

            // Step 2: Prompt the user for save location
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: getDefaultSaveUri('csharp-dump'),
                filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Zip files': ['zip'],
                },
                saveLabel: vscode.l10n.t('Save Dump'),
                title: vscode.l10n.t('Save Dump'),
            });
            if (!saveUri) {
                return; // User cancelled
            }

            const dumpFolder = path.dirname(saveUri.fsPath);
            if (!fs.existsSync(dumpFolder)) {
                showErrorMessageWithOptions(
                    vscode,
                    vscode.l10n.t({
                        message: 'Folder for dump file {0} does not exist',
                        args: [dumpFolder],
                        comment: ['{0} is the folder path'],
                    }),
                    { modal: true }
                );
                return;
            }

            // Step 3: Collect dumps and create archive with progress
            let errorMessage: string | undefined;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: vscode.l10n.t('Collect Dump'),
                    cancellable: false,
                },
                async (progress) => {
                    try {
                        await executeDumpCollection(
                            context,
                            dumpRequests,
                            dumpFolder,
                            saveUri,
                            progress,
                            outputChannel,
                            traceChannel
                        );
                    } catch (error) {
                        errorMessage = error instanceof Error ? error.message : String(error);
                    }
                }
            );

            // Show messages after progress is dismissed
            if (errorMessage) {
                showErrorMessageWithOptions(
                    vscode,
                    vscode.l10n.t({
                        message: 'Failed to collect dump: {0}',
                        args: [errorMessage],
                        comment: ['{0} is the error message'],
                    }),
                    { modal: true }
                );
            } else {
                const openFolder = vscode.l10n.t('Open Folder');
                const result = await vscode.window.showInformationMessage(
                    vscode.l10n.t('Dump saved successfully.'),
                    openFolder
                );
                if (result === openFolder) {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            }
        })
    );
}

/**
 * Executes the dump collection and archiving.
 */
async function executeDumpCollection(
    context: vscode.ExtensionContext,
    dumpRequests: DumpRequest[],
    dumpFolder: string,
    saveUri: vscode.Uri,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): Promise<void> {
    // Verify tools are installed
    progress.report({
        message: vscode.l10n.t('Verifying tools...'),
    });

    const toolsVerified = await verifyDumpTools(dumpRequests, dumpFolder, progress, outputChannel);
    if (!toolsVerified) {
        throw new Error(vscode.l10n.t('Required dump tools could not be installed.'));
    }

    // Collect all dumps
    const collectedDumps = await collectDumps(dumpRequests, dumpFolder, progress, outputChannel);

    // Collect logs and create archive
    progress.report({
        message: vscode.l10n.t('Creating archive...'),
    });

    // Use createZipWithLogs which handles log files, settings, and additional files
    // Pass empty strings for activity logs since we're not capturing activity during this command
    await createZipWithLogs(
        context,
        outputChannel,
        traceChannel,
        '', // No activity log content for dump command
        '', // No activity log content for dump command
        saveUri.fsPath,
        undefined, // No trace file
        collectedDumps // Dump files as additional files (will be cleaned up)
    );
}
