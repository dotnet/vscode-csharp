/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';
import { ObservableLogOutputChannel } from './observableLogOutputChannel';
import {
    verifyOrAcquireDotnetTool,
    collectDumps,
    createZipWithLogs,
    getDefaultSaveUri,
    selectDumpsWithArguments,
    verifyDumpTools,
    promptForToolArguments,
    DumpRequest,
} from './loggingUtils';

const TraceTerminalName = 'dotnet-trace';

export function getProfilingEnvVars(outputChannel: vscode.LogOutputChannel): NodeJS.ProcessEnv {
    let profilingEnvVars = {};
    if (process.env.ROSLYN_DOTNET_EventPipeOutputPath) {
        profilingEnvVars = {
            DOTNET_EnableEventPipe: 1,
            DOTNET_EventPipeConfig: 'Microsoft-Windows-DotNETRuntime:0x1F000080018:5',
            DOTNET_EventPipeOutputPath: process.env.ROSLYN_DOTNET_EventPipeOutputPath,
            DOTNET_ReadyToRun: 0,
            DOTNET_TieredCompilation: 1,
            DOTNET_TC_CallCounting: 0,
            DOTNET_TC_QuickJitForLoops: 1,
            DOTNET_JitCollect64BitCounts: 1,
        };
        outputChannel.trace(`Profiling enabled with:${EOL}${JSON.stringify(profilingEnvVars)}`);
    }

    return profilingEnvVars;
}

interface TraceResults {
    traceFilePath: string;
    dumpFiles: string[];
    csharpLog: string;
    lspLog: string;
}

export function registerTraceCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.recordLanguageServerTrace', async () => {
            const processId = languageServer.processId;
            if (!processId) {
                showErrorMessageWithOptions(
                    vscode,
                    vscode.l10n.t('Language server process not found, ensure the server is running.'),
                    { modal: true }
                );
                return;
            }

            // Step 1: Get trace arguments
            const dotnetTraceArgs = `--process-id ${processId} --clreventlevel informational --providers "Microsoft-DotNETCore-SampleProfiler,Microsoft-Windows-DotNETRuntime,Microsoft-CodeAnalysis-General:0xFFFFFFFF:5,Microsoft-CodeAnalysis-Workspaces:0xFFFFFFFF:5,RoslynEventSource:0xFFFFFFFF:5"`;
            const userArgs = await promptForToolArguments('dotnet-trace', dotnetTraceArgs);
            if (userArgs === undefined) {
                return; // User cancelled
            }

            // Step 2: Ask about optional dumps and get arguments
            const dumpRequests = await selectDumpsWithArguments({
                title: vscode.l10n.t('Capture Dumps With Trace'),
                placeHolder: vscode.l10n.t('Optionally select dump(s) to capture before and after the trace'),
                processId,
                allowEmpty: true,
            });
            if (dumpRequests === undefined) {
                return; // User cancelled
            }

            // Step 3: Ask for save location
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: getDefaultSaveUri('csharp-trace'),
                filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'Zip files': ['zip'],
                },
                saveLabel: vscode.l10n.t('Save Trace and Logs'),
                title: vscode.l10n.t('Save Trace and Logs'),
            });
            if (!saveUri) {
                return; // User cancelled
            }

            const traceFolder = path.dirname(saveUri.fsPath);
            if (!fs.existsSync(traceFolder)) {
                showErrorMessageWithOptions(
                    vscode,
                    vscode.l10n.t({
                        message: 'Folder for trace file {0} does not exist',
                        args: [traceFolder],
                        comment: ['{0} is the folder path'],
                    }),
                    { modal: true }
                );
                return;
            }

            // Step 4: Execute the trace with progress
            let traceResults: TraceResults | undefined;
            let resultUri: vscode.Uri | undefined;
            let errorMessage: string | undefined;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'dotnet-trace',
                    cancellable: true,
                },
                async (progress, token) => {
                    try {
                        traceResults = await executeTraceCollection(
                            languageServer,
                            userArgs,
                            dumpRequests,
                            traceFolder,
                            progress,
                            outputChannel,
                            traceChannel,
                            token
                        );
                    } catch (error) {
                        errorMessage = error instanceof Error ? error.message : String(error);
                    }
                }
            );

            if (errorMessage) {
                showErrorMessageWithOptions(
                    vscode,
                    vscode.l10n.t({
                        message: 'Failed to execute dotnet-trace command: {0}',
                        args: [errorMessage],
                        comment: 'dotnet-trace is a command name and should not be localized',
                    }),
                    { modal: true }
                );
                return;
            }

            if (!traceResults) {
                return;
            }

            // After the trace is stopped (via cancellation or natural completion), we need a new progress
            // notification since the original one may have been dismissed by cancellation.
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'dotnet-trace',
                    cancellable: false,
                },
                async (progress) => {
                    try {
                        resultUri = await saveTraceResults(
                            traceResults!,
                            context,
                            dumpRequests,
                            traceFolder,
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

            if (resultUri) {
                const openFolder = vscode.l10n.t('Open Folder');
                const result = await vscode.window.showInformationMessage(
                    vscode.l10n.t('C# logs saved successfully.'),
                    openFolder
                );
                if (result === openFolder) {
                    await vscode.commands.executeCommand('revealFileInOS', resultUri);
                }
            }
        })
    );
}

/**
 * Executes the trace collection and archiving.
 */
async function executeTraceCollection(
    languageServer: RoslynLanguageServer,
    userArgs: string,
    dumpRequests: DumpRequest[],
    traceFolder: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel,
    cancellationToken: vscode.CancellationToken
): Promise<TraceResults | undefined> {
    // Verify dotnet-trace is installed
    progress.report({
        message: vscode.l10n.t({
            message: 'Verifying dotnet-trace...',
            comment: 'dotnet-trace is a command name and should not be localized',
        }),
    });

    const dotnetTraceInstalled = await verifyOrAcquireDotnetTool('dotnet-trace', traceFolder, progress, outputChannel);
    if (!dotnetTraceInstalled) {
        return undefined;
    }

    const allDumpFiles: string[] = [];

    // Verify dump tools if needed
    if (dumpRequests.length > 0) {
        const toolsVerified = await verifyDumpTools(dumpRequests, traceFolder, progress, outputChannel);
        if (!toolsVerified) {
            throw new Error(vscode.l10n.t('Required dump tools could not be installed.'));
        }

        const startDumps = await collectDumps(dumpRequests, traceFolder, progress, outputChannel, 'before-trace');
        allDumpFiles.push(...startDumps);
    }

    const csharpLogObserver = outputChannel.observe();
    const traceLogObserver = traceChannel.observe();

    // Set log levels to Trace for capture and get the restore function
    const restoreLogLevels = await languageServer.setLogLevelsForCapture();

    try {
        const terminal = await getOrCreateTerminal(traceFolder, outputChannel);

        const args = ['collect', ...userArgs.split(' ')];

        progress.report({ message: vscode.l10n.t('Recording logs... Click Cancel to stop and save.') });
        const traceFilePath = await runDotnetTrace(args, terminal, traceFolder, cancellationToken);
        if (!traceFilePath) {
            return undefined;
        }

        return {
            traceFilePath,
            dumpFiles: allDumpFiles,
            csharpLog: csharpLogObserver.getLog(),
            lspLog: traceLogObserver.getLog(),
        };
    } finally {
        // Always clean up observers and restore log levels
        csharpLogObserver.dispose();
        traceLogObserver.dispose();
        await restoreLogLevels();
    }
}

async function saveTraceResults(
    traceResults: TraceResults,
    context: vscode.ExtensionContext,
    dumpRequests: DumpRequest[],
    traceFolder: string,
    saveUri: vscode.Uri,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    outputChannel: ObservableLogOutputChannel,
    traceChannel: ObservableLogOutputChannel
): Promise<vscode.Uri | undefined> {
    // Collect dumps after trace if any selected
    if (dumpRequests.length > 0) {
        const endDumps = await collectDumps(dumpRequests, traceFolder, progress, outputChannel, 'after-trace');
        traceResults.dumpFiles.push(...endDumps);
    }

    progress.report({
        message: vscode.l10n.t('Creating archive...'),
    });

    await createZipWithLogs(
        context,
        outputChannel,
        traceChannel,
        traceResults.csharpLog,
        traceResults.lspLog,
        saveUri.fsPath,
        traceResults.traceFilePath,
        traceResults.dumpFiles
    );

    return saveUri;
}

async function runDotnetTrace(
    args: string[],
    terminal: vscode.Terminal,
    traceFolder: string,
    token: vscode.CancellationToken
): Promise<string | undefined> {
    // Use a terminal to execute the dotnet-trace.  This is much simpler and more reliable than executing dotnet-trace
    // directly via the child_process module as dotnet-trace relies on shell input in order to stop the trace.
    // Without using a psuedo-terminal, it is extremely difficult to send the correct signal to stop the trace.
    //
    // Luckily, VSCode allows us to use the built in terminal (a psuedo-terminal) to execute commands, which also provides a way to send input to it.

    terminal.show();
    const command = `dotnet-trace ${args.join(' ')}`;

    const shellIntegration = terminal.shellIntegration;
    if (shellIntegration) {
        await new Promise<number>((resolve, _) => {
            const execution = shellIntegration.executeCommand(command);

            // If the progress is cancelled, we need to send a Ctrl+C to the terminal to stop the command.
            const cancelDisposable = token.onCancellationRequested(() => {
                terminal.sendText('^C');
            });

            vscode.window.onDidEndTerminalShellExecution((e) => {
                if (e.execution === execution) {
                    cancelDisposable.dispose(); // Clean up the cancellation listener.
                    resolve(e.exitCode ?? 1); // If exitCode is undefined, assume failure (1).
                }
            });
        });
    } else {
        // Without shell integration we can't listen for the command to finish.  We can't execute it as a child process either (see above).
        // Instead we fire and forget the command.  The user can stop the trace collection by interacting with the terminal directly.
        terminal.sendText(command);

        // Wait for cancellation since we can't detect when the command finishes
        await new Promise<void>((resolve) => {
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

    // Find the most recent .nettrace file in the trace folder
    return findLatestNettraceFile(traceFolder);
}

async function getOrCreateTerminal(
    folder: string,
    outputChannel: ObservableLogOutputChannel
): Promise<vscode.Terminal> {
    const existing = vscode.window.terminals.find((t) => t.name === TraceTerminalName);
    if (existing) {
        const options: vscode.TerminalOptions = existing.creationOptions;
        if (options.cwd === folder) {
            // If the terminal already exists and was created for the same folder, re-use it.
            return await waitForTerminalReady(existing, outputChannel);
        }
    }

    existing?.dispose(); // Dispose of the existing terminal if it exists but is for a different folder.

    const options: vscode.TerminalOptions = {
        name: TraceTerminalName,
        cwd: folder,
    };

    const terminal = vscode.window.createTerminal(options);

    return await waitForTerminalReady(terminal, outputChannel);
}

async function waitForTerminalReady(
    terminal: vscode.Terminal,
    outputChannel: ObservableLogOutputChannel
): Promise<vscode.Terminal> {
    // The shell integration feature is required for us to be able to see the result of a command in the terminal.
    // However the shell integration feature has a couple of special behaviors:
    //    1.  It is not available immediately after the terminal is created, we must wait to see if it is available.
    //    2.  Shell integration is not available in all scenarios (e.g. cmd on windows) and may never be set.

    // Subscribe to the terminal shell integration change event to see if it ever gets set.
    const terminalPromise = new Promise<boolean>((resolve) => {
        vscode.window.onDidChangeTerminalShellIntegration((e) => {
            if (e.terminal === terminal) {
                resolve(true);
            }
        });

        if (terminal.shellIntegration) {
            resolve(true);
        }
    });

    // Race with a promise that resolves after a timeout to ensure we don't wait indefinitely for a terminal that may never have shell integration.
    const timeout = new Promise<boolean>((resolve) => {
        setTimeout((_) => resolve(false), 3000);
    });

    const shellIntegration = await Promise.race([terminalPromise, timeout]);
    if (!shellIntegration) {
        outputChannel.debug('The terminal shell integration is not available for the dotnet-trace terminal.');
    }

    return terminal;
}

/**
 * Finds the most recently created .nettrace file in the specified folder.
 */
function findLatestNettraceFile(folder: string): string | undefined {
    try {
        const files = fs.readdirSync(folder);
        const nettraceFiles = files
            .filter((f) => f.endsWith('.nettrace'))
            .map((f) => {
                const fullPath = path.join(folder, f);
                const stats = fs.statSync(fullPath);
                return { path: fullPath, mtime: stats.mtime };
            })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        return nettraceFiles.length > 0 ? nettraceFiles[0].path : undefined;
    } catch {
        return undefined;
    }
}
