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
    const terminal = await getOrCreateTerminal(folder, outputChannel);
    terminal.show();

    const command = `dotnet-trace collect ${args.join(' ')}`;
    const shellIntegration = terminal.shellIntegration;

    if (shellIntegration) {
        await new Promise<number>((resolve, _) => {
            const execution = shellIntegration.executeCommand(command);

            const cancelDisposable = token.onCancellationRequested(() => {
                terminal.sendText('^C');
            });

            vscode.window.onDidEndTerminalShellExecution((e) => {
                if (e.execution === execution) {
                    cancelDisposable.dispose();
                    resolve(e.exitCode ?? 1);
                }
            });
        });
    } else {
        // Without shell integration we can't listen for the command to finish.
        // Fire and forget the command; the user can interact with the terminal directly.
        terminal.sendText(command);

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

    existing?.dispose();

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
