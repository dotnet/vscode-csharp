/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';
import { ObservableLogOutputChannel } from './observableLogOutputChannel';
import {
    DumpRequest,
    collectDumps,
    createZipWithLogs,
    getDefaultSaveUri,
    getDumpConfig,
    promptForToolArguments,
    verifyOrAcquireDotnetTool,
    DumpType,
    createActivityLogCapture,
} from './loggingUtils';
import { runDotnetTraceInTerminal } from './profiling';
import { RazorLogger } from '../../razor/src/razorLogger';

/** Represents the types of data the user can choose to collect */
type CollectOption = 'activityLogs' | 'performanceTrace' | 'memoryDump' | 'gcDump';

interface CollectOptionQuickPickItem extends vscode.QuickPickItem {
    option: CollectOption;
}

interface LogsToCollect {
    activityLogs: boolean;
    performanceTrace: boolean;
    memoryDump: boolean;
    gcDump: boolean;
}

/**
 * Registers the unified collect logs command.
 */
export function registerCollectLogsCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    razorLogger: RazorLogger
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.collectLogs', async () => {
            await collectLogs(context, languageServer, outputChannel, traceChannel, razorLogger);
        })
    );
}

async function collectLogs(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    razorLogger: RazorLogger
): Promise<void> {
    // Step 1: Let the user select which additional logs or dumps to collect.
    const selectedLogs = await selectAdditionalLogs();
    if (!selectedLogs) {
        return;
    }

    const dumpSelected = selectedLogs.memoryDump || selectedLogs.gcDump;

    // processId is only required if the user is collecting a performance trace or memory dumps.
    const processId = RoslynLanguageServer.processId ?? -1;
    if (selectedLogs.performanceTrace || dumpSelected) {
        // Validate process ID is available if trace or dumps are needed
        if (processId === -1) {
            showErrorMessageWithOptions(
                vscode,
                vscode.l10n.t('Language server process not found, ensure the server is running.'),
                { modal: true }
            );
            return;
        }
    }

    // Step 2: Verify tools and let the user customize arguments for each selected tool
    const defaultSaveUri = getDefaultSaveUri('csharp-logs');
    const toolFolder = path.dirname(defaultSaveUri.fsPath);

    const toolConfigs = await prepareTools(
        processId,
        toolFolder,
        outputChannel,
        selectedLogs.performanceTrace,
        selectedLogs.memoryDump,
        selectedLogs.gcDump
    );
    if (!toolConfigs) {
        return;
    }

    // Step 3: Prompt for save location
    const zipFile = await chooseSaveLocation(defaultSaveUri);
    if (!zipFile) {
        return;
    }

    // Step 4: Execute the collection
    const archiveResult =
        selectedLogs.activityLogs || selectedLogs.performanceTrace
            ? await archiveActivity(
                  context,
                  languageServer,
                  outputChannel,
                  traceChannel,
                  razorLogger,
                  selectedLogs,
                  dumpSelected,
                  toolConfigs.dumpConfigs,
                  zipFile.parentFolder,
                  zipFile.uri,
                  toolConfigs.traceArgs
              )
            : await archiveDumps(
                  context,
                  outputChannel,
                  traceChannel,
                  razorLogger,
                  toolConfigs.dumpConfigs,
                  zipFile.parentFolder,
                  zipFile.uri
              );

    // Show result message
    if (archiveResult.errorMessage) {
        showErrorMessageWithOptions(
            vscode,
            vscode.l10n.t({
                message: 'Failed to collect logs: {0}',
                args: [archiveResult.errorMessage],
                comment: ['{0} is the error message'],
            }),
            { modal: true }
        );
    } else if (archiveResult.uri) {
        const openFolder = vscode.l10n.t('Open Folder');
        const result = await vscode.window.showInformationMessage(
            vscode.l10n.t('C# logs saved successfully.'),
            openFolder
        );
        if (result === openFolder) {
            await vscode.commands.executeCommand('revealFileInOS', archiveResult.uri);
        }
    }
}

async function selectAdditionalLogs(): Promise<LogsToCollect | undefined> {
    const items: CollectOptionQuickPickItem[] = [
        {
            label: vscode.l10n.t('Record Activity'),
            description: vscode.l10n.t('Capture live C#, LSP trace, and Razor log output'),
            detail: vscode.l10n.t('Records verbose extension logging and stops when canceled.'),
            option: 'activityLogs',
        },
        {
            label: vscode.l10n.t('Performance Trace'),
            description: vscode.l10n.t('Record a dotnet-trace of the language server'),
            detail: vscode.l10n.t('Captures runtime events from the language server process until canceled.'),
            option: 'performanceTrace',
        },
        {
            label: vscode.l10n.t('Memory Dump'),
            description: vscode.l10n.t('Process memory dump using dotnet-dump'),
            detail: vscode.l10n.t('Creates a full process dump for troubleshooting and analysis.'),
            option: 'memoryDump',
        },
        {
            label: vscode.l10n.t('GC Dump'),
            description: vscode.l10n.t('Garbage collector heap dump using dotnet-gcdump'),
            detail: vscode.l10n.t('Captures managed heap information for investigating memory issues.'),
            option: 'gcDump',
        },
    ];

    const selected = await vscode.window.showQuickPick(items, {
        title: vscode.l10n.t('Collect C# Logs'),
        placeHolder: vscode.l10n.t('Select additional logging to collect'),
        canPickMany: true,
    });

    if (!selected || selected.length === 0) {
        return undefined;
    }

    const selectedOptions = new Set(selected.map((s) => s.option));
    return {
        activityLogs: selectedOptions.has('activityLogs'),
        performanceTrace: selectedOptions.has('performanceTrace'),
        memoryDump: selectedOptions.has('memoryDump'),
        gcDump: selectedOptions.has('gcDump'),
    };
}

async function prepareTools(
    processId: number,
    toolFolder: string,
    outputChannel: ObservableLogOutputChannel,
    performanceTrace: boolean,
    memoryDump: boolean,
    gcDump: boolean
): Promise<
    | {
          traceArgs: string | undefined;
          dumpConfigs: DumpRequest[];
      }
    | undefined
> {
    let toolsReady = true;
    let traceArgs: string | undefined;
    const dumpConfigs: DumpRequest[] = [];

    await collectingWithProgress(/* cancellable */ false, async (progress) => {
        if (performanceTrace) {
            progress.report({
                message: vscode.l10n.t({
                    message: 'Verifying dotnet-trace...',
                    comment: 'dotnet-trace is a command name and should not be localized',
                }),
            });

            const installed = await verifyOrAcquireDotnetTool('dotnet-trace', toolFolder, progress, outputChannel);
            if (!installed) {
                toolsReady = false;
                return;
            }

            const defaultTraceArgs = `--process-id ${processId} --clreventlevel informational --providers "Microsoft-DotNETCore-SampleProfiler,Microsoft-Windows-DotNETRuntime,Microsoft-CodeAnalysis-General:0xFFFFFFFF:5,Microsoft-CodeAnalysis-Workspaces:0xFFFFFFFF:5,RoslynEventSource:0xFFFFFFFF:5"`;
            traceArgs = await promptForToolArguments('dotnet-trace', defaultTraceArgs);
            if (traceArgs === undefined) {
                toolsReady = false;
                return;
            }
        }

        if (memoryDump) {
            progress.report({
                message: vscode.l10n.t({
                    message: 'Verifying dotnet-dump...',
                    comment: 'dotnet-dump is a command name and should not be localized',
                }),
            });
            const installed = await verifyOrAcquireDotnetTool('dotnet-dump', toolFolder, progress, outputChannel);
            if (!installed) {
                toolsReady = false;
                return;
            }

            const config = getDumpConfig('memory');
            const defaultArgs = config.defaultArgs.replace('{processId}', processId.toString());
            const args = await promptForToolArguments(config.toolName, defaultArgs);
            if (args === undefined) {
                toolsReady = false;
                return;
            }
            dumpConfigs.push({ type: 'memory' as DumpType, args });
        }

        if (gcDump) {
            progress.report({
                message: vscode.l10n.t({
                    message: 'Verifying dotnet-gcdump...',
                    comment: 'dotnet-gcdump is a command name and should not be localized',
                }),
            });
            const installed = await verifyOrAcquireDotnetTool('dotnet-gcdump', toolFolder, progress, outputChannel);
            if (!installed) {
                toolsReady = false;
                return;
            }

            const config = getDumpConfig('gc');
            const defaultArgs = config.defaultArgs.replace('{processId}', processId.toString());
            const args = await promptForToolArguments(config.toolName, defaultArgs);
            if (args === undefined) {
                toolsReady = false;
                return;
            }
            dumpConfigs.push({ type: 'gc' as DumpType, args });
        }
    });

    if (!toolsReady) {
        return undefined;
    }

    return {
        traceArgs,
        dumpConfigs,
    };
}

async function chooseSaveLocation(
    defaultSaveUri: vscode.Uri
): Promise<{ uri: vscode.Uri; parentFolder: string } | undefined> {
    const uri = await vscode.window.showSaveDialog({
        defaultUri: defaultSaveUri,
        filters: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Zip files': ['zip'],
        },
        saveLabel: vscode.l10n.t('Save Logs'),
        title: vscode.l10n.t('Save Logs'),
    });
    if (!uri) {
        return undefined;
    }

    const parentFolder = path.dirname(uri.fsPath);
    if (!fs.existsSync(parentFolder)) {
        showErrorMessageWithOptions(
            vscode,
            vscode.l10n.t({
                message: 'Output folder {0} does not exist',
                args: [parentFolder],
                comment: ['{0} is the folder path'],
            }),
            { modal: true }
        );
        return undefined;
    }

    return {
        uri,
        parentFolder,
    };
}

async function archiveDumps(
    context: vscode.ExtensionContext,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    razorLogger: RazorLogger,
    dumpConfigs: DumpRequest[],
    outputFolder: string,
    saveUri: vscode.Uri
): Promise<{ uri: vscode.Uri | undefined; errorMessage: string | undefined }> {
    let errorMessage: string | undefined;
    let uri: vscode.Uri | undefined;

    await collectingWithProgress(/* cancellable */ false, async (progress) => {
        try {
            const collectedDumps = await collectDumps(dumpConfigs, outputFolder, progress, outputChannel);

            progress.report({ message: vscode.l10n.t('Creating archive...') });
            await createZipWithLogs(
                context,
                outputChannel,
                traceChannel,
                razorLogger,
                /* activityLogs */ undefined,
                saveUri.fsPath,
                undefined,
                collectedDumps
            );

            uri = saveUri;
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : String(error);
        }
    });

    return {
        uri,
        errorMessage,
    };
}

async function archiveActivity(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    razorLogger: RazorLogger,
    selectedLogs: LogsToCollect,
    dumpSelected: boolean,
    dumpConfigs: DumpRequest[],
    outputFolder: string,
    saveUri: vscode.Uri,
    traceArgs: string | undefined
): Promise<{ uri: vscode.Uri | undefined; errorMessage: string | undefined }> {
    let errorMessage: string | undefined;
    let uri: vscode.Uri | undefined;

    const capture = await createActivityLogCapture(languageServer, outputChannel, traceChannel, razorLogger);

    try {
        let traceFilePath: string | undefined;
        const dumpFiles: string[] = [];

        if (dumpSelected) {
            await collectingWithProgress(/* cancellable */ false, async (progress) => {
                const startDumps = await collectDumps(dumpConfigs, outputFolder, progress, outputChannel, 'before');
                dumpFiles.push(...startDumps);
            });
        }

        const message = selectedLogs.performanceTrace
            ? vscode.l10n.t('Recording trace... Click Cancel to stop and save.')
            : vscode.l10n.t('Recording logs... Click Cancel to stop and save.');
        const collectTask = selectedLogs.performanceTrace
            ? async (token: vscode.CancellationToken) =>
                  runDotnetTraceInTerminal(traceArgs!.split(' '), outputFolder, outputChannel, token)
            : async (token: vscode.CancellationToken) => await waitForCancellation(token);

        await collectingWithProgress(/* cancellable */ true, async (progress, token) => {
            try {
                progress.report({ message });
                traceFilePath = await collectTask(token);
            } catch (error) {
                errorMessage = error instanceof Error ? error.message : String(error);
            }
        });

        if (errorMessage) {
            return {
                uri,
                errorMessage,
            };
        }

        const activityLogs = selectedLogs.activityLogs ? capture.getActivityLogs() : undefined;

        await collectingWithProgress(/* cancellable */ false, async (progress) => {
            try {
                if (dumpSelected) {
                    const afterDumps = await collectDumps(dumpConfigs, outputFolder, progress, outputChannel, 'after');
                    dumpFiles.push(...afterDumps);
                }

                progress.report({
                    message: vscode.l10n.t('Creating archive...'),
                });

                await createZipWithLogs(
                    context,
                    outputChannel,
                    traceChannel,
                    razorLogger,
                    activityLogs,
                    saveUri.fsPath,
                    traceFilePath,
                    dumpFiles
                );

                uri = saveUri;
            } catch (error) {
                errorMessage = error instanceof Error ? error.message : String(error);
            }
        });
    } finally {
        capture.dispose();
    }

    return {
        uri,
        errorMessage,
    };
}

async function collectingWithProgress<T>(
    cancellable: boolean,
    task: (
        progress: vscode.Progress<{
            message?: string;
            increment?: number;
        }>,
        token: vscode.CancellationToken
    ) => Promise<T>
) {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: vscode.l10n.t('Collecting C# Logs'),
            cancellable: cancellable,
        },
        task
    );
}

/**
 * Waits for the cancellation token to be triggered.
 */
async function waitForCancellation(token: vscode.CancellationToken): Promise<undefined> {
    return new Promise<undefined>((resolve) => {
        if (token.isCancellationRequested) {
            resolve(undefined);
            return;
        }

        const disposable = token.onCancellationRequested(() => {
            disposable.dispose();
            resolve(undefined);
        });
    });
}
