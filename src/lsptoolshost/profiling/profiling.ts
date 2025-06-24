/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as vscode from 'vscode';
import { EOL } from 'os';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { showErrorMessageWithOptions } from '../../shared/observers/utils/showMessage';
import { execChildProcess } from '../../common';

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

export function registerTraceCommand(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    outputChannel: vscode.LogOutputChannel
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('csharp.recordTrace', async () => {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'dotnet-trace',
                    cancellable: true,
                },
                async (progress, token) => {
                    progress.report({
                        message: vscode.l10n.t({
                            message: 'Initializing dotnet-trace...',
                            comment: 'dotnet-trace is a command name and should not be localized',
                        }),
                    });
                    try {
                        await executeDotNetTraceCommand(languageServer, progress, outputChannel, token);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        showErrorMessageWithOptions(
                            vscode,
                            vscode.l10n.t({
                                message: 'Failed to execute dotnet-trace command: {0}',
                                args: [errorMessage],
                                comment: 'dotnet-trace is a command name and should not be localized',
                            }),
                            { modal: true }
                        );
                    }
                }
            );
        })
    );
}

async function executeDotNetTraceCommand(
    languageServer: RoslynLanguageServer,
    progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>,
    outputChannel: vscode.LogOutputChannel,
    cancellationToken: vscode.CancellationToken
): Promise<void> {
    const processId = languageServer.processId;

    if (!processId) {
        throw new Error(vscode.l10n.t('Language server process not found, ensure the server is running.'));
    }

    let traceFolder: string | undefined = '';
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders?.length >= 1) {
        traceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    // Prompt the user for the folder to save the trace file
    // By default, choose the first workspace folder if available.
    const uris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: traceFolder ? vscode.Uri.file(traceFolder) : undefined,
        openLabel: vscode.l10n.t('Select Trace Folder'),
        title: vscode.l10n.t('Select Folder to Save Trace File'),
    });

    if (uris === undefined || uris.length === 0) {
        // User cancelled the dialog
        return;
    }

    traceFolder = uris[0].fsPath;

    if (!fs.existsSync(traceFolder)) {
        throw new Error(vscode.l10n.t(`Folder for trace file {0} does not exist`, traceFolder));
    }

    const dotnetTraceArgs = `--process-id ${processId} --clreventlevel informational --providers "Microsoft-DotNETCore-SampleProfiler,Microsoft-Windows-DotNETRuntime"`;

    // Show an input box pre-populated with the default dotnet trace arguments
    const userArgs = await vscode.window.showInputBox({
        value: dotnetTraceArgs,
        placeHolder: vscode.l10n.t({
            message: 'Enter dotnet-trace arguments',
            comment: 'dotnet-trace is a command name and should not be localized',
        }),
        prompt: vscode.l10n.t('You can modify the default arguments if needed'),
    });
    if (userArgs === undefined) {
        // User cancelled the input box
        return;
    }

    const terminal = await getOrCreateTerminal(traceFolder, outputChannel);

    const dotnetTraceInstalled = await verifyOrAcquireDotnetTrace(traceFolder, progress, outputChannel);
    if (!dotnetTraceInstalled) {
        // Cancelled or unable to install dotnet-trace
        return;
    }

    const args = ['collect', ...userArgs.split(' ')];

    progress.report({ message: vscode.l10n.t('Recording trace...') });
    await runDotnetTrace(args, terminal, cancellationToken);
}

async function verifyOrAcquireDotnetTrace(
    folder: string,
    progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>,
    channel: vscode.LogOutputChannel
): Promise<boolean> {
    try {
        await execChildProcess('dotnet-trace --version', folder, process.env);
        return true; // If the command succeeds, dotnet-trace is installed.
    } catch (error) {
        channel.debug(`Failed to execute dotnet-trace --version with error: ${error}`);
    }

    const confirmAction = {
        title: vscode.l10n.t('Install'),
    };
    const installCommand = 'dotnet tool install --global dotnet-trace';
    const confirmResult = await vscode.window.showInformationMessage(
        vscode.l10n.t({
            message: 'dotnet-trace not found, run "{0}" to install it?',
            args: [installCommand],
            comment: 'dotnet-trace is a command name and should not be localized',
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
            message: 'Installing dotnet-trace...',
            comment: 'dotnet-trace is a command name and should not be localized',
        }),
    });

    try {
        await execChildProcess(installCommand, folder, process.env);
        return true;
    } catch (error) {
        channel.error(`Failed to install dotnet-trace with error: ${error}`);
        await vscode.window.showErrorMessage(
            vscode.l10n.t({
                message:
                    'Failed to install dotnet-trace, it may need to be manually installed. See C# output for details.',
                comment: 'dotnet-trace is a command name and should not be localized',
            }),
            {
                modal: true,
            }
        );
        return false;
    }
}

async function runDotnetTrace(
    args: string[],
    terminal: vscode.Terminal,
    token: vscode.CancellationToken
): Promise<void> {
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
    }
}

async function getOrCreateTerminal(folder: string, outputChannel: vscode.LogOutputChannel): Promise<vscode.Terminal> {
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
    outputChannel: vscode.LogOutputChannel
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
