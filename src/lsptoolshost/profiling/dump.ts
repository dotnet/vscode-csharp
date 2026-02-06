/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import archiver from 'archiver';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';
import { execChildProcess } from '../../common';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';
import { getDefaultSaveUri } from '../logging/captureLogs';

export function registerDumpCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.collectDump', async () => {
            let saveUri: vscode.Uri | undefined;
            let errorMessage: string | undefined;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'dotnet-dump',
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({
                        message: vscode.l10n.t({
                            message: 'Initializing dotnet-dump...',
                            comment: 'dotnet-dump is a command name and should not be localized',
                        }),
                    });
                    try {
                        saveUri = await executeDotNetDumpCommand(languageServer, progress, outputChannel);
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
                        message: 'Failed to execute dotnet-dump command: {0}',
                        args: [errorMessage],
                        comment: 'dotnet-dump is a command name and should not be localized',
                    }),
                    { modal: true }
                );
            } else if (saveUri) {
                const openFolder = vscode.l10n.t('Open Folder');
                const result = await vscode.window.showInformationMessage(
                    vscode.l10n.t('C# memory dump saved successfully.'),
                    openFolder
                );
                if (result === openFolder) {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            }
        })
    );
}

async function executeDotNetDumpCommand(
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
        defaultUri: getDefaultSaveUri('csharp-dump'),
        filters: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Zip files': ['zip'],
        },
        saveLabel: vscode.l10n.t('Save Dump'),
        title: vscode.l10n.t('Save C# Memory Dump'),
    });

    if (!saveUri) {
        // User cancelled the save dialog
        return undefined;
    }

    // Get the folder for temporary dump file output
    const dumpFolder = path.dirname(saveUri.fsPath);

    if (!fs.existsSync(dumpFolder)) {
        throw new Error(vscode.l10n.t(`Folder for dump file {0} does not exist`, dumpFolder));
    }

    const dotnetDumpInstalled = await verifyOrAcquireDotnetDump(dumpFolder, progress, outputChannel);
    if (!dotnetDumpInstalled) {
        // Cancelled or unable to install dotnet-dump
        return undefined;
    }

    const dotnetDumpArgs = `--process-id ${processId} --type Full`;

    // Show an input box pre-populated with the default dotnet-dump arguments
    const userArgs = await vscode.window.showInputBox({
        value: dotnetDumpArgs,
        placeHolder: vscode.l10n.t({
            message: 'Enter dotnet-dump arguments',
            comment: 'dotnet-dump is a command name and should not be localized',
        }),
        prompt: vscode.l10n.t('You can modify the default arguments if needed'),
    });
    if (userArgs === undefined) {
        // User cancelled the input box
        return undefined;
    }

    progress.report({
        message: vscode.l10n.t('Collecting memory dump...'),
    });

    // Execute dotnet-dump collect
    const dumpFilePath = await collectDump(userArgs, dumpFolder, outputChannel);

    if (!dumpFilePath) {
        throw new Error(vscode.l10n.t('Failed to create dump file.'));
    }

    progress.report({
        message: vscode.l10n.t('Creating archive...'),
    });

    await createZipWithDump(saveUri.fsPath, dumpFilePath);

    return saveUri;
}

async function verifyOrAcquireDotnetDump(
    folder: string,
    progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>,
    channel: ObservableLogOutputChannel
): Promise<boolean> {
    try {
        await execChildProcess('dotnet-dump --version', folder, process.env);
        return true; // If the command succeeds, dotnet-dump is installed.
    } catch (error) {
        channel.debug(`Failed to execute dotnet-dump --version with error: ${error}`);
    }

    const confirmAction = {
        title: vscode.l10n.t('Install'),
    };
    const installCommand = 'dotnet tool install --global dotnet-dump';
    const confirmResult = await vscode.window.showInformationMessage(
        vscode.l10n.t({
            message: 'dotnet-dump not found, run "{0}" to install it?',
            args: [installCommand],
            comment: 'dotnet-dump is a command name and should not be localized',
        }),
        {
            modal: true,
        },
        confirmAction
    );

    if (confirmResult !== confirmAction) {
        return false;
    }

    progress.report({
        message: vscode.l10n.t({
            message: 'Installing dotnet-dump...',
            comment: 'dotnet-dump is a command name and should not be localized',
        }),
    });

    try {
        await execChildProcess(installCommand, folder, process.env);
        return true;
    } catch (error) {
        channel.error(`Failed to install dotnet-dump with error: ${error}`);
        await vscode.window.showErrorMessage(
            vscode.l10n.t({
                message:
                    'Failed to install dotnet-dump, it may need to be manually installed. See C# output for details.',
                comment: 'dotnet-dump is a command name and should not be localized',
            }),
            {
                modal: true,
            }
        );
        return false;
    }
}

async function collectDump(
    userArgs: string,
    dumpFolder: string,
    channel: ObservableLogOutputChannel
): Promise<string | undefined> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dumpFileName = `csharp-lsp-${timestamp}.dmp`;
    const dumpFilePath = path.join(dumpFolder, dumpFileName);

    const command = `dotnet-dump collect ${userArgs} --output "${dumpFilePath}"`;
    channel.info(`Executing: ${command}`);

    try {
        const output = await execChildProcess(command, dumpFolder, process.env);
        channel.info(`dotnet-dump output: ${output}`);

        if (fs.existsSync(dumpFilePath)) {
            return dumpFilePath;
        }

        // Check if dump was created with a different extension (some versions use .dmp, others don't)
        const filesInFolder = fs.readdirSync(dumpFolder);
        const dumpFile = filesInFolder.find(
            (f) => f.startsWith('csharp-lsp-') && (f.endsWith('.dmp') || f.includes(timestamp))
        );
        if (dumpFile) {
            return path.join(dumpFolder, dumpFile);
        }

        return undefined;
    } catch (error) {
        channel.error(`Failed to collect dump: ${error}`);
        throw error;
    }
}

/**
 * Creates a zip file containing only the dump file.
 */
async function createZipWithDump(outputPath: string, dumpFilePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 },
        });

        output.on('close', () => {
            // Clean up the temporary dump file after adding to archive
            if (fs.existsSync(dumpFilePath)) {
                try {
                    fs.unlinkSync(dumpFilePath);
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

        // Add dump file to the archive
        archive.file(dumpFilePath, { name: path.basename(dumpFilePath) });

        void archive.finalize();
    });
}
