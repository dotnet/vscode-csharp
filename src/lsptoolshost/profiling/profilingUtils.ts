/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import archiver from 'archiver';
import { execChildProcess } from '../../common';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { getDefaultSaveUri } from '../logging/captureLogs';

/**
 * Configuration for a dump collection command.
 */
export interface DumpCommandConfig {
    /** The VS Code command name (e.g., 'csharp.collectDump') */
    commandName: string;
    /** The name of the dotnet tool (e.g., 'dotnet-dump', 'dotnet-gcdump') */
    toolName: string;
    /** The file extension for the dump file (e.g., 'dmp', 'gcdump') */
    fileExtension: string;
    /** Prefix for the default save file name */
    filePrefix: string;
    /** Label for the save dialog */
    saveLabel: string;
    /** Default arguments for the tool (process-id will be substituted) */
    defaultArgs: string;
    /** Progress message shown while collecting */
    collectingMessage: string;
    /** Error message shown if dump creation fails */
    failedMessage: string;
    /** Success message shown when dump is saved */
    successMessage: string;
}

/**
 * Verifies that a dotnet global tool is installed, and prompts the user to install it if not.
 * @param toolName The name of the dotnet tool (e.g., 'dotnet-trace', 'dotnet-dump', 'dotnet-gcdump')
 * @param folder The folder to run the command in
 * @param progress The progress reporter to update during installation
 * @param channel The output channel for logging
 * @returns True if the tool is installed (or was successfully installed), false otherwise
 */
export async function verifyOrAcquireDotnetTool(
    toolName: string,
    folder: string,
    progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>,
    channel: ObservableLogOutputChannel
): Promise<boolean> {
    try {
        await execChildProcess(`${toolName} --version`, folder, process.env);
        return true; // If the command succeeds, the tool is installed.
    } catch (error) {
        channel.debug(`Failed to execute ${toolName} --version with error: ${error}`);
    }

    const confirmAction = {
        title: vscode.l10n.t('Install'),
    };
    const installCommand = `dotnet tool install --global ${toolName}`;
    const confirmResult = await vscode.window.showInformationMessage(
        vscode.l10n.t({
            message: '{0} not found, run "{1}" to install it?',
            args: [toolName, installCommand],
            comment: ['{0} is the tool name and should not be localized', '{1} is the install command'],
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
            message: 'Installing {0}...',
            args: [toolName],
            comment: ['{0} is the tool name and should not be localized'],
        }),
    });

    try {
        await execChildProcess(installCommand, folder, process.env);
        return true;
    } catch (error) {
        channel.error(`Failed to install ${toolName} with error: ${error}`);
        await vscode.window.showErrorMessage(
            vscode.l10n.t({
                message: 'Failed to install {0}, it may need to be manually installed. See C# output for details.',
                args: [toolName],
                comment: ['{0} is the tool name and should not be localized'],
            }),
            {
                modal: true,
            }
        );
        return false;
    }
}

/**
 * Creates a zip file containing a single file, then cleans up the source file.
 * @param outputPath The path for the output zip file
 * @param sourceFilePath The path to the file to add to the archive
 */
async function createZipWithFile(outputPath: string, sourceFilePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 },
        });

        output.on('close', () => {
            // Clean up the temporary source file after adding to archive
            if (fs.existsSync(sourceFilePath)) {
                try {
                    fs.unlinkSync(sourceFilePath);
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

        // Add the file to the archive
        archive.file(sourceFilePath, { name: path.basename(sourceFilePath) });

        void archive.finalize();
    });
}

/**
 * Collects a dump using a dotnet diagnostic tool.
 * @param toolName The name of the dotnet tool (e.g., 'dotnet-dump', 'dotnet-gcdump')
 * @param fileExtension The file extension for the dump file (e.g., 'dmp', 'gcdump')
 * @param userArgs The user-provided arguments for the tool
 * @param dumpFolder The folder to write the dump file to
 * @param channel The output channel for logging
 * @returns The path to the created dump file, or undefined if creation failed
 */
async function collectDumpWithTool(
    toolName: string,
    fileExtension: string,
    userArgs: string,
    dumpFolder: string,
    channel: ObservableLogOutputChannel
): Promise<string | undefined> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dumpFileName = `csharp-lsp-${timestamp}.${fileExtension}`;
    const dumpFilePath = path.join(dumpFolder, dumpFileName);

    const command = `${toolName} collect ${userArgs} --output "${dumpFilePath}"`;
    channel.info(`Executing: ${command}`);

    try {
        const output = await execChildProcess(command, dumpFolder, process.env);
        channel.info(`${toolName} output: ${output}`);

        if (fs.existsSync(dumpFilePath)) {
            return dumpFilePath;
        }

        // Check if dump was created with a different name
        const filesInFolder = fs.readdirSync(dumpFolder);
        const dumpFile = filesInFolder.find(
            (f) => f.startsWith('csharp-lsp-') && (f.endsWith(`.${fileExtension}`) || f.includes(timestamp))
        );
        if (dumpFile) {
            return path.join(dumpFolder, dumpFile);
        }

        return undefined;
    } catch (error) {
        channel.error(`Failed to collect ${fileExtension} dump: ${error}`);
        throw error;
    }
}

/**
 * Executes a dump collection command with the given configuration.
 * Handles the common flow: save dialog, tool installation, argument input, collection, and archiving.
 */
async function executeDumpCommand(
    config: DumpCommandConfig,
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
        defaultUri: getDefaultSaveUri(config.filePrefix),
        filters: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Zip files': ['zip'],
        },
        saveLabel: config.saveLabel,
        title: config.saveLabel,
    });

    if (!saveUri) {
        // User cancelled the save dialog
        return undefined;
    }

    // Get the folder for temporary dump file output
    const dumpFolder = path.dirname(saveUri.fsPath);

    if (!fs.existsSync(dumpFolder)) {
        throw new Error(
            vscode.l10n.t({
                message: 'Folder for dump file {0} does not exist',
                args: [dumpFolder],
                comment: ['{0} is the folder path'],
            })
        );
    }

    const toolInstalled = await verifyOrAcquireDotnetTool(config.toolName, dumpFolder, progress, outputChannel);
    if (!toolInstalled) {
        // Cancelled or unable to install tool
        return undefined;
    }

    const defaultArgs = config.defaultArgs.replace('{processId}', processId.toString());

    // Show an input box pre-populated with the default arguments
    const userArgs = await vscode.window.showInputBox({
        value: defaultArgs,
        placeHolder: vscode.l10n.t({
            message: 'Enter {0} arguments',
            args: [config.toolName],
            comment: ['{0} is the tool name and should not be localized'],
        }),
        prompt: vscode.l10n.t('You can modify the default arguments if needed'),
    });
    if (userArgs === undefined) {
        // User cancelled the input box
        return undefined;
    }

    progress.report({
        message: config.collectingMessage,
    });

    // Execute the dump collection
    const dumpFilePath = await collectDumpWithTool(
        config.toolName,
        config.fileExtension,
        userArgs,
        dumpFolder,
        outputChannel
    );

    if (!dumpFilePath) {
        throw new Error(config.failedMessage);
    }

    progress.report({
        message: vscode.l10n.t('Creating archive...'),
    });

    await createZipWithFile(saveUri.fsPath, dumpFilePath);

    return saveUri;
}

/**
 * Registers a dump collection command with the given configuration.
 * Handles the full command registration including progress notifications and error handling.
 */
export function registerDumpToolCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    config: DumpCommandConfig
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(config.commandName, async () => {
            let saveUri: vscode.Uri | undefined;
            let errorMessage: string | undefined;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: config.toolName,
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({
                        message: vscode.l10n.t({
                            message: 'Initializing {0}...',
                            args: [config.toolName],
                            comment: ['{0} is the tool name and should not be localized'],
                        }),
                    });
                    try {
                        saveUri = await executeDumpCommand(config, languageServer, progress, outputChannel);
                    } catch (error) {
                        errorMessage = error instanceof Error ? error.message : String(error);
                    }
                }
            );

            // Show messages after progress is dismissed
            if (errorMessage) {
                await vscode.window.showErrorMessage(
                    vscode.l10n.t({
                        message: 'Failed to execute {0} command: {1}',
                        args: [config.toolName, errorMessage],
                        comment: ['{0} is the tool name and should not be localized', '{1} is the error message'],
                    }),
                    { modal: true }
                );
            } else if (saveUri) {
                const openFolder = vscode.l10n.t('Open Folder');
                const result = await vscode.window.showInformationMessage(config.successMessage, openFolder);
                if (result === openFolder) {
                    await vscode.commands.executeCommand('revealFileInOS', saveUri);
                }
            }
        })
    );
}
