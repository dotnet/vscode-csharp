/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import archiver from 'archiver';
import { execChildProcess } from '../../common';
import { getDefaultSaveUri, gatherCurrentSettings } from '../logging/captureLogs';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { ObservableLogOutputChannel } from '../logging/observableLogOutputChannel';
import { verifyOrAcquireDotnetTool } from './profilingUtils';

/**
 * Configuration for a dump tool.
 */
interface DumpToolConfig {
    /** The name of the dotnet tool (e.g., 'dotnet-dump', 'dotnet-gcdump') */
    toolName: string;
    /** The file extension for the dump file (e.g., 'dmp', 'gcdump') */
    fileExtension: string;
    /** Default arguments for the tool (process-id will be substituted) */
    defaultArgs: string;
    /** Progress message shown while collecting */
    collectingMessage: string;
}

/** Memory dump tool configuration */
const memoryDumpConfig: DumpToolConfig = {
    toolName: 'dotnet-dump',
    fileExtension: 'dmp',
    defaultArgs: '--process-id {processId} --type Full',
    collectingMessage: vscode.l10n.t('Collecting memory dump...'),
};

/** GC dump tool configuration */
const gcDumpConfig: DumpToolConfig = {
    toolName: 'dotnet-gcdump',
    fileExtension: 'gcdump',
    defaultArgs: '--process-id {processId}',
    collectingMessage: vscode.l10n.t('Collecting GC dump...'),
};

/** Types of content that can be collected */
export type DumpContentType = 'memory' | 'gc' | 'logs';

interface DumpContentQuickPickItem extends vscode.QuickPickItem {
    type: DumpContentType;
    picked?: boolean;
}

export function registerDumpCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.collectDump', async () => {
            // First, let the user select content type(s)
            const selectedTypes = await selectDumpContent();
            if (!selectedTypes) {
                return; // User cancelled
            }

            let saveUri: vscode.Uri | undefined;
            let errorMessage: string | undefined;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: vscode.l10n.t('Collect Dump'),
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({
                        message: vscode.l10n.t('Initializing...'),
                    });
                    try {
                        saveUri = await executeCombinedDumpCommand(
                            context,
                            selectedTypes,
                            languageServer,
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
                await vscode.window.showErrorMessage(
                    vscode.l10n.t({
                        message: 'Failed to collect dump: {0}',
                        args: [errorMessage],
                        comment: ['{0} is the error message'],
                    }),
                    { modal: true }
                );
            } else if (saveUri) {
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
 * Creates a zip file containing multiple files, then cleans up the specified temp files.
 * @param outputPath The path for the output zip file
 * @param filesToArchive All files to add to the archive
 * @param filesToDelete Files to delete after archiving (temp files only)
 */
async function createZipWithFiles(
    outputPath: string,
    filesToArchive: string[],
    filesToDelete: string[]
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 },
        });

        output.on('close', () => {
            // Clean up the temporary files after adding to archive
            for (const filePath of filesToDelete) {
                if (fs.existsSync(filePath)) {
                    try {
                        fs.unlinkSync(filePath);
                    } catch {
                        // Ignore cleanup errors
                    }
                }
            }
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);

        // Add all files to the archive
        for (const filePath of filesToArchive) {
            archive.file(filePath, { name: path.basename(filePath) });
        }

        void archive.finalize();
    });
}

/**
 * Collects a single dump with the given configuration.
 * Returns the path to the created dump file.
 */
async function collectSingleDump(
    config: DumpToolConfig,
    processId: number,
    dumpFolder: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    outputChannel: ObservableLogOutputChannel
): Promise<string | undefined> {
    const defaultArgs = config.defaultArgs.replace('{processId}', processId.toString());

    // Show an input box pre-populated with the default arguments
    const userArgs = await vscode.window.showInputBox({
        value: defaultArgs,
        title: vscode.l10n.t({
            message: '{0} Arguments',
            args: [config.toolName],
            comment: ['{0} is the tool name and should not be localized'],
        }),
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

    return await collectDumpWithTool(config.toolName, config.fileExtension, userArgs, dumpFolder, outputChannel);
}

/**
 * Executes the combined dump command, allowing user to select dump types and collect them.
 */
async function executeCombinedDumpCommand(
    context: vscode.ExtensionContext,
    selectedTypes: DumpContentType[],
    languageServer: RoslynLanguageServer,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): Promise<vscode.Uri | undefined> {
    const processId = languageServer.processId;

    // Only require processId if collecting dumps (not just logs)
    const collectingDumps = selectedTypes.includes('memory') || selectedTypes.includes('gc');
    if (collectingDumps && !processId) {
        throw new Error(vscode.l10n.t('Language server process not found, ensure the server is running.'));
    }

    // Prompt the user for save location
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
        return undefined;
    }

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

    const collectedFiles: string[] = []; // All files to add to archive
    const tempFiles: string[] = []; // Temp files to delete after archiving

    // Collect memory dump if selected
    if (selectedTypes.includes('memory')) {
        const toolInstalled = await verifyOrAcquireDotnetTool(
            memoryDumpConfig.toolName,
            dumpFolder,
            progress,
            outputChannel
        );
        if (!toolInstalled) {
            return undefined;
        }

        const dumpFile = await collectSingleDump(memoryDumpConfig, processId!, dumpFolder, progress, outputChannel);
        if (dumpFile === undefined) {
            return undefined; // User cancelled
        }
        if (dumpFile) {
            collectedFiles.push(dumpFile);
            tempFiles.push(dumpFile);
        }
    }

    // Collect GC dump if selected
    if (selectedTypes.includes('gc')) {
        const toolInstalled = await verifyOrAcquireDotnetTool(
            gcDumpConfig.toolName,
            dumpFolder,
            progress,
            outputChannel
        );
        if (!toolInstalled) {
            return undefined;
        }

        const dumpFile = await collectSingleDump(gcDumpConfig, processId!, dumpFolder, progress, outputChannel);
        if (dumpFile === undefined) {
            return undefined; // User cancelled
        }
        if (dumpFile) {
            collectedFiles.push(dumpFile);
            tempFiles.push(dumpFile);
        }
    }

    // Collect logs if selected
    if (selectedTypes.includes('logs')) {
        progress.report({
            message: vscode.l10n.t('Collecting logs...'),
        });

        // Add existing log files from disk
        const csharpLogPath = vscode.Uri.joinPath(context.logUri, outputChannel.name + '.log');
        const traceLogPath = vscode.Uri.joinPath(context.logUri, traceChannel.name + '.log');

        if (fs.existsSync(csharpLogPath.fsPath)) {
            collectedFiles.push(csharpLogPath.fsPath);
        }
        if (fs.existsSync(traceLogPath.fsPath)) {
            collectedFiles.push(traceLogPath.fsPath);
        }

        // Write current settings to a temp file
        const settingsContent = gatherCurrentSettings();
        const settingsFilePath = path.join(dumpFolder, 'csharp-settings.json');
        fs.writeFileSync(settingsFilePath, settingsContent);
        collectedFiles.push(settingsFilePath);
        tempFiles.push(settingsFilePath);
    }

    if (collectedFiles.length === 0) {
        throw new Error(vscode.l10n.t('Failed to collect any content.'));
    }

    progress.report({
        message: vscode.l10n.t('Creating archive...'),
    });

    await createZipWithFiles(saveUri.fsPath, collectedFiles, tempFiles);

    return saveUri;
}

/**
 * Shows a quick pick for the user to select content type(s) and returns the selected types.
 */
async function selectDumpContent(): Promise<DumpContentType[] | undefined> {
    const items: DumpContentQuickPickItem[] = [
        {
            label: vscode.l10n.t('Memory Dump'),
            description: vscode.l10n.t('Full process memory dump using dotnet-dump'),
            type: 'memory',
        },
        {
            label: vscode.l10n.t('GC Dump'),
            description: vscode.l10n.t('Garbage collector heap dump using dotnet-gcdump'),
            type: 'gc',
        },
        {
            label: vscode.l10n.t('Logs'),
            description: vscode.l10n.t('Current C# extension log files and settings'),
            type: 'logs',
            picked: true,
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: vscode.l10n.t('Select Content to Collect'),
        placeHolder: vscode.l10n.t('Choose which content to include in the archive'),
        canPickMany: true,
    });

    if (!selected || selected.length === 0) {
        return undefined;
    }

    return selected.map((item) => item.type);
}
