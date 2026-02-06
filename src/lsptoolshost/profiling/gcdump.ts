/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';
import { execChildProcess } from '../../common';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';
import { getDefaultSaveUri } from '../logging/captureLogs';
import { verifyOrAcquireDotnetTool, createZipWithFile } from './profilingUtils';

export function registerGcDumpCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.collectGcDump', async () => {
            let saveUri: vscode.Uri | undefined;
            let errorMessage: string | undefined;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'dotnet-gcdump',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({
                        message: vscode.l10n.t({
                            message: 'Initializing dotnet-gcdump...',
                            comment: 'dotnet-gcdump is a command name and should not be localized',
                        }),
                    });
                    try {
                        saveUri = await executeDotNetGcDumpCommand(languageServer, progress, outputChannel);
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
                        message: 'Failed to execute dotnet-gcdump command: {0}',
                        args: [errorMessage],
                        comment: 'dotnet-gcdump is a command name and should not be localized',
                    }),
                    { modal: true }
                );
            } else if (saveUri) {
                const openFolder = vscode.l10n.t('Open Folder');
                const result = await vscode.window.showInformationMessage(
                    vscode.l10n.t('C# GC dump saved successfully.'),
                    openFolder
                );
                if (result === openFolder) {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            }
        })
    );
}

async function executeDotNetGcDumpCommand(
    languageServer: RoslynLanguageServer,
    progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>,
    outputChannel: ObservableLogOutputChannel
): Promise<vscode.Uri | undefined> {
    const processId = languageServer.processId;

    if (!processId) {
        throw new Error(vscode.l10n.t('Language server process not found, ensure the server is running.'));
    }

    // Prompt the user for save location first
    const saveUri = await vscode.window.showSaveDialog({
        defaultUri: getDefaultSaveUri('csharp-gcdump'),
        filters: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Zip files': ['zip'],
        },
        saveLabel: vscode.l10n.t('Save GC Dump'),
        title: vscode.l10n.t('Save C# GC Dump'),
    });

    if (!saveUri) {
        // User cancelled the save dialog
        return undefined;
    }

    // Get the folder for temporary dump file output
    const dumpFolder = path.dirname(saveUri.fsPath);

    if (!fs.existsSync(dumpFolder)) {
        throw new Error(vscode.l10n.t(`Folder for GC dump file {0} does not exist`, dumpFolder));
    }

    const dotnetGcDumpInstalled = await verifyOrAcquireDotnetTool('dotnet-gcdump', dumpFolder, progress, outputChannel);
    if (!dotnetGcDumpInstalled) {
        // Cancelled or unable to install dotnet-gcdump
        return undefined;
    }

    const dotnetGcDumpArgs = `--process-id ${processId}`;

    // Show an input box pre-populated with the default dotnet-gcdump arguments
    const userArgs = await vscode.window.showInputBox({
        value: dotnetGcDumpArgs,
        placeHolder: vscode.l10n.t({
            message: 'Enter dotnet-gcdump arguments',
            comment: 'dotnet-gcdump is a command name and should not be localized',
        }),
        prompt: vscode.l10n.t('You can modify the default arguments if needed'),
    });
    if (userArgs === undefined) {
        // User cancelled the input box
        return undefined;
    }

    progress.report({
        message: vscode.l10n.t('Collecting GC dump...'),
    });

    // Execute dotnet-gcdump collect
    const dumpFilePath = await collectGcDump(userArgs, dumpFolder, outputChannel);

    if (!dumpFilePath) {
        throw new Error(vscode.l10n.t('Failed to create GC dump file.'));
    }

    progress.report({
        message: vscode.l10n.t('Creating archive...'),
    });

    await createZipWithFile(saveUri.fsPath, dumpFilePath);

    return saveUri;
}

async function collectGcDump(
    userArgs: string,
    dumpFolder: string,
    channel: ObservableLogOutputChannel
): Promise<string | undefined> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dumpFileName = `csharp-lsp-${timestamp}.gcdump`;
    const dumpFilePath = path.join(dumpFolder, dumpFileName);

    const command = `dotnet-gcdump collect ${userArgs} --output "${dumpFilePath}"`;
    channel.info(`Executing: ${command}`);

    try {
        const output = await execChildProcess(command, dumpFolder, process.env);
        channel.info(`dotnet-gcdump output: ${output}`);

        if (fs.existsSync(dumpFilePath)) {
            return dumpFilePath;
        }

        // Check if dump was created with a different name
        const filesInFolder = fs.readdirSync(dumpFolder);
        const dumpFile = filesInFolder.find(
            (f) => f.startsWith('csharp-lsp-') && (f.endsWith('.gcdump') || f.includes(timestamp))
        );
        if (dumpFile) {
            return path.join(dumpFolder, dumpFile);
        }

        return undefined;
    } catch (error) {
        channel.error(`Failed to collect GC dump: ${error}`);
        throw error;
    }
}
