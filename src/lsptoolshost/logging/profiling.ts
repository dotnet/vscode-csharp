/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { ObservableLogOutputChannel } from './observableLogOutputChannel';

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

/**
 * Runs dotnet-trace in a VS Code terminal and returns the path to the .nettrace file.
 * @param args The arguments to pass to `dotnet-trace collect`
 * @param folder The working directory for the terminal
 * @param outputChannel The output channel for logging
 * @param token A cancellation token to stop the trace
 * @returns The path to the generated .nettrace file, or undefined if not found
 */
export async function runDotnetTraceInTerminal(
    args: string[],
    folder: string,
    outputChannel: ObservableLogOutputChannel,
    token: vscode.CancellationToken
): Promise<string | undefined> {
    // Use a terminal to execute the dotnet-trace.  This is much simpler and more reliable than executing dotnet-trace
    // directly via the child_process module as dotnet-trace relies on shell input in order to stop the trace.
    // Without using a psuedo-terminal, it is extremely difficult to send the correct signal to stop the trace.
    //
    // Luckily, VSCode allows us to use the built in terminal (a psuedo-terminal) to execute commands, which also provides a way to send input to it.

    const terminal = await getOrCreateTerminal(folder, outputChannel);
    terminal.show();

    const command = `dotnet-trace collect ${args.join(' ')}`;
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
    return findLatestNettraceFile(folder);
}

async function getOrCreateTerminal(
    folder: string,
    outputChannel: ObservableLogOutputChannel
): Promise<vscode.Terminal> {
    const existing = vscode.window.terminals.find((t) => t.name === TraceTerminalName);
    if (existing) {
        const options: vscode.TerminalOptions = existing.creationOptions;
        if (options.cwd === folder) {
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
