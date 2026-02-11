/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import archiver from 'archiver';
import { execChildProcess } from '../../common';
import { Message, ObservableLogOutputChannel } from './observableLogOutputChannel';
import { RazorLogger } from '../../razor/src/razorLogger';

/**
 * Configuration for a dump tool.
 */
export interface DumpToolConfig {
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
export const memoryDumpConfig: DumpToolConfig = {
    toolName: 'dotnet-dump',
    fileExtension: 'dmp',
    defaultArgs: '--process-id {processId} --type Full',
    collectingMessage: vscode.l10n.t('Collecting memory dump...'),
};

/** GC dump tool configuration */
export const gcDumpConfig: DumpToolConfig = {
    toolName: 'dotnet-gcdump',
    fileExtension: 'gcdump',
    defaultArgs: '--process-id {processId}',
    collectingMessage: vscode.l10n.t('Collecting GC dump...'),
};

/** Types of dumps that can be collected */
export type DumpType = 'memory' | 'gc';

/**
 * Gets the dump tool config for a given dump type.
 */
export function getDumpConfig(type: DumpType): DumpToolConfig {
    return type === 'memory' ? memoryDumpConfig : gcDumpConfig;
}

/** A single dump request with its type and arguments */
export interface DumpRequest {
    type: DumpType;
    args: string;
}

/**
 * Collects dumps based on the provided requests.
 * @param dumpRequests The dump requests with arguments
 * @param folder The folder to save dumps to
 * @param progress Progress reporter
 * @param outputChannel Output channel for logging
 * @param filePrefix Optional prefix for the dump file name (defaults to 'csharp-lsp')
 * @returns Array of paths to the collected dump files
 */
export async function collectDumps(
    dumpRequests: DumpRequest[],
    folder: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    outputChannel: ObservableLogOutputChannel,
    filePrefix: string = 'csharp-lsp'
): Promise<string[]> {
    const collectedFiles: string[] = [];

    for (const request of dumpRequests) {
        const config = getDumpConfig(request.type);

        progress.report({
            message: config.collectingMessage,
        });

        try {
            const dumpFile = await collectDumpWithTool(
                config.toolName,
                config.fileExtension,
                request.args,
                folder,
                outputChannel,
                filePrefix
            );
            if (dumpFile) {
                collectedFiles.push(dumpFile);
            }
        } catch (error) {
            outputChannel.error(`Failed to collect ${request.type} dump: ${error}`);
            // Continue with other dumps even if one fails
        }
    }

    return collectedFiles;
}

interface DumpTypeQuickPickItem extends vscode.QuickPickItem {
    type: DumpType;
}

/** Options for selecting dump types and gathering arguments */
export interface SelectDumpsOptions {
    /** Title for the quick pick */
    title: string;
    /** Placeholder text */
    placeHolder: string;
    /** The process ID for the target process */
    processId: number;
    /** If true, returns empty array when nothing selected. If false, returns undefined. */
    allowEmpty?: boolean;
}

/**
 * Shows a quick pick to select dump types and gathers arguments for each selected type.
 * @param options Configuration for the selection and the target process ID
 * @returns Array of DumpRequest with arguments, undefined if cancelled, or empty array if allowEmpty is true and nothing selected
 */
export async function selectDumpsWithArguments(options: SelectDumpsOptions): Promise<DumpRequest[] | undefined> {
    const items: DumpTypeQuickPickItem[] = [
        {
            label: vscode.l10n.t('Memory Dump'),
            description: vscode.l10n.t('Process memory dump using dotnet-dump'),
            type: 'memory',
        },
        {
            label: vscode.l10n.t('GC Dump'),
            description: vscode.l10n.t('Garbage collector heap dump using dotnet-gcdump'),
            type: 'gc',
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: options.title,
        placeHolder: options.placeHolder,
        canPickMany: true,
    });

    if (!selected) {
        return options.allowEmpty ? [] : undefined;
    }

    if (selected.length === 0) {
        return options.allowEmpty ? [] : undefined;
    }

    // Gather arguments for each selected dump type
    const dumpRequests: DumpRequest[] = [];
    for (const item of selected) {
        const config = getDumpConfig(item.type);
        const defaultArgs = config.defaultArgs.replace('{processId}', options.processId.toString());
        const args = await promptForToolArguments(config.toolName, defaultArgs);
        if (args === undefined) {
            return undefined; // User cancelled
        }

        dumpRequests.push({ type: item.type, args });
    }

    return dumpRequests;
}

/**
 * Verifies that all dump tools are installed for the given requests.
 * @param dumpRequests The dump requests to verify tools for
 * @param folder The folder to run tool verification in
 * @param progress Progress reporter
 * @param outputChannel Output channel for logging
 * @returns True if all tools are installed, false if cancelled or failed
 */
export async function verifyDumpTools(
    dumpRequests: DumpRequest[],
    folder: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    outputChannel: ObservableLogOutputChannel
): Promise<boolean> {
    // Get unique tool names to avoid verifying the same tool twice
    const toolNames = new Set(dumpRequests.map((r) => getDumpConfig(r.type).toolName));

    for (const toolName of toolNames) {
        const toolInstalled = await verifyOrAcquireDotnetTool(toolName, folder, progress, outputChannel);
        if (!toolInstalled) {
            return false;
        }
    }
    return true;
}

/**
 * Prompts the user for tool arguments with customizable defaults.
 * @param toolName The name of the tool (displayed in the input box title)
 * @param defaultArgs The default arguments to pre-populate
 * @returns The user-provided arguments, or undefined if cancelled
 */
export async function promptForToolArguments(toolName: string, defaultArgs: string): Promise<string | undefined> {
    return await vscode.window.showInputBox({
        value: defaultArgs,
        title: vscode.l10n.t({
            message: '{0} Arguments',
            args: [toolName],
            comment: ['{0} is the tool name and should not be localized'],
        }),
        placeHolder: vscode.l10n.t({
            message: 'Enter {0} arguments',
            args: [toolName],
            comment: ['{0} is the tool name and should not be localized'],
        }),
        prompt: vscode.l10n.t('You can modify the default arguments if needed'),
    });
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
 * Collects a dump using a dotnet diagnostic tool.
 * @param toolName The name of the dotnet tool (e.g., 'dotnet-dump', 'dotnet-gcdump')
 * @param fileExtension The file extension for the dump file (e.g., 'dmp', 'gcdump')
 * @param userArgs The user-provided arguments for the tool
 * @param dumpFolder The folder to write the dump file to
 * @param channel The output channel for logging
 * @param filePrefix Optional prefix for the dump file name (defaults to 'csharp-lsp')
 * @returns The path to the created dump file, or undefined if creation failed
 */
export async function collectDumpWithTool(
    toolName: string,
    fileExtension: string,
    userArgs: string,
    dumpFolder: string,
    channel: ObservableLogOutputChannel,
    filePrefix: string = 'csharp-lsp'
): Promise<string | undefined> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dumpFileName = `${filePrefix}-${timestamp}.${fileExtension}`;
    const dumpFilePath = path.join(dumpFolder, dumpFileName);

    const command = `${toolName} collect ${userArgs} --output "${dumpFilePath}"`;
    channel.info(`Executing: ${command}`);

    try {
        const output = await execChildProcess(command, dumpFolder, process.env);
        channel.info(`${toolName} output: ${output}`);

        return fs.existsSync(dumpFilePath) ? dumpFilePath : undefined;
    } catch (error) {
        channel.error(`Failed to collect ${fileExtension} dump: ${error}`);
        throw error;
    }
}

/**
 * Creates a zip file containing the log contents and optionally a trace file.
 * Includes both the captured activity logs and the existing log files from the extension context.
 * @param additionalFiles Optional array of file paths to include in the archive (will be deleted after archiving)
 */
export async function createZipWithLogs(
    context: vscode.ExtensionContext,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    razorLogger: RazorLogger,
    csharpActivityLogContent: string,
    traceActivityLogContent: string,
    razorActivityLogContent: string,
    outputPath: string,
    traceFilePath?: string,
    additionalFiles?: string[]
): Promise<void> {
    // Read existing log files from disk
    const csharpLogPath = vscode.Uri.joinPath(context.logUri, outputChannel.name + '.log');
    const traceLogPath = vscode.Uri.joinPath(context.logUri, traceChannel.name + '.log');
    const razorLogPath = vscode.Uri.joinPath(context.logUri, razorLogger.outputChannel.name + '.log');

    const csharpLogContent = await readLogFileContent(csharpLogPath, outputChannel);
    const traceLogContent = await readLogFileContent(traceLogPath, outputChannel);
    const razorLogContent = await readLogFileContent(razorLogPath, outputChannel);

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
            // Clean up additional files
            if (additionalFiles) {
                for (const filePath of additionalFiles) {
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                        } catch {
                            // Ignore cleanup errors
                        }
                    }
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

        // Add additional files to the archive
        if (additionalFiles) {
            for (const filePath of additionalFiles) {
                if (fs.existsSync(filePath)) {
                    archive.file(filePath, { name: path.basename(filePath) });
                }
            }
        }

        // Add existing log files to the archive
        if (csharpLogContent) {
            archive.append(csharpLogContent, { name: 'csharp.log' });
        }
        if (traceLogContent) {
            archive.append(traceLogContent, { name: 'csharp-lsp-trace.log' });
        }
        if (razorLogContent) {
            archive.append(razorLogContent, { name: 'razor.log' });
        }

        // Add captured activity logs to the archive
        if (csharpActivityLogContent !== '') {
            archive.append(csharpActivityLogContent, { name: 'csharp.activity.log' });
        }
        if (traceActivityLogContent !== '') {
            archive.append(traceActivityLogContent, { name: 'csharp-lsp-trace.activity.log' });
        }
        if (razorActivityLogContent !== '') {
            archive.append(razorActivityLogContent, { name: 'razor.activity.log' });
        }

        // Add current settings to the archive
        const settingsContent = gatherCurrentSettings();
        archive.append(settingsContent, { name: 'csharp-settings.json' });

        void archive.finalize();
    });
}

/**
 * Reads the content of a log file, returning null if the file doesn't exist.
 */
export async function readLogFileContent(
    logFileUri: vscode.Uri,
    outputChannel: ObservableLogOutputChannel
): Promise<string | null> {
    try {
        const content = await vscode.workspace.fs.readFile(logFileUri);
        return Buffer.from(content).toString('utf8');
    } catch {
        // File doesn't exist or can't be read. This can happen if the logLevel
        // is set in such a way that no messages are being logged, for instance if
        // the C# LSP Trace log level is set to "info". We need to handle this
        // gracefully. Write a debug message and return null.
        outputChannel.debug(`Log file not found: ${logFileUri.fsPath}`);
        return null;
    }
}

/**
 * Gathers the current VS Code settings for dotnet, csharp, razor, and omnisharp namespaces.
 * Reads the setting keys from the extension's package.json to enumerate all available settings.
 * Returns a formatted JSON string.
 */
export function gatherCurrentSettings(): string {
    const extensionId = 'ms-dotnettools.csharp';
    const extension = vscode.extensions.getExtension(extensionId);

    if (!extension) {
        return JSON.stringify({ error: 'Could not find C# extension' }, null, 2);
    }

    // Get all configuration properties defined in package.json
    const packageJson = extension.packageJSON as {
        contributes?: {
            configuration?: Array<{
                properties?: Record<string, unknown>;
            }>;
        };
    };

    const configurationSections = packageJson?.contributes?.configuration;
    if (!configurationSections || !Array.isArray(configurationSections)) {
        return JSON.stringify({ error: 'No configuration found in package.json' }, null, 2);
    }

    // Collect all setting keys from package.json, grouped by their section prefix
    const settingsBySection: Record<string, string[]> = {};

    for (const section of configurationSections) {
        if (section.properties) {
            for (const fullKey of Object.keys(section.properties)) {
                // Split the full key (e.g., "dotnet.server.path") into section and rest
                const dotIndex = fullKey.indexOf('.');
                if (dotIndex > 0) {
                    const sectionName = fullKey.substring(0, dotIndex);
                    if (!settingsBySection[sectionName]) {
                        settingsBySection[sectionName] = [];
                    }
                    settingsBySection[sectionName].push(fullKey);
                }
            }
        }
    }

    // Get the current value for each setting
    const result: Record<string, Record<string, unknown>> = {};

    for (const [sectionName, settingKeys] of Object.entries(settingsBySection)) {
        result[sectionName] = {};
        const config = vscode.workspace.getConfiguration();

        for (const fullKey of settingKeys) {
            // Get the setting key without the section prefix for the result
            const keyWithoutSection = fullKey.substring(sectionName.length + 1);
            result[sectionName][keyWithoutSection] = config.get(fullKey);
        }
    }

    return JSON.stringify(result, null, 2);
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

/**
 * Observes log messages from an RazorLogger and collects them until disposed.
 */
export class RazorLogObserver {
    private readonly _messages: Message[] = [];
    private readonly _subscription: vscode.Disposable;

    constructor(logger: RazorLogger) {
        this._subscription = logger.onLog((message) => {
            this._messages.push({ message, timestamp: new Date() });
        });
    }

    /**
     * Returns the collected messages as a formatted string suitable for a log file.
     */
    public getLog(): string {
        return RazorLogObserver.formatLogMessages(this._messages);
    }

    /**
     * Disposes the subscription and stops observing log messages.
     */
    public dispose(): void {
        this._subscription.dispose();
    }

    /**
     * Formats an array of log messages into a string suitable for a log file.
     */
    public static formatLogMessages(messages: Message[]): string {
        return messages
            .map((msg) => {
                const timestamp = msg.timestamp.toISOString();
                return `[${timestamp}] ${msg.message}`;
            })
            .join('\n');
    }
}
