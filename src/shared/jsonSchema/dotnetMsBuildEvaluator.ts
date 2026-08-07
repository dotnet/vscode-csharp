/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { ChildProcess, SpawnOptions, spawn as spawnProcess } from 'child_process';

export interface DotnetMsBuildOptions {
    /** Overridable for tests; defaults to `child_process.spawn`. */
    spawn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
    /** Path to the `dotnet` executable; defaults to resolving `dotnet` from the environment. */
    dotnetExecutablePath?: string;
    timeoutMilliseconds: number;
    maxOutputBytes: number;
    signal?: AbortSignal;
}

/** How long a terminated evaluation is given to exit before it is killed forcefully. */
const forcedTerminationDelayMilliseconds = 1_000;

/**
 * Evaluates a project and returns the raw stdout of
 * `dotnet msbuild <project> -getItem:JsonSchemaSegment -nologo`.
 *
 * `-getItem` only evaluates the project; it does not run targets, restore packages or write to the
 * output folder, which keeps this safe to run in response to opening an editor.
 *
 * The command line is deliberately built as an argument array with `shell: false` so that project
 * paths containing shell metacharacters cannot be interpreted as commands, and the child is bounded
 * by both a timeout and an output limit so that a hung or chatty evaluation cannot pin the extension
 * host.
 */
export async function runDotnetMsBuild(projectPath: string, options: DotnetMsBuildOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
            reject(new Error(`dotnet msbuild evaluation for '${projectPath}' was cancelled.`));
            return;
        }

        const spawn = options.spawn ?? spawnProcess;
        const args = ['msbuild', projectPath, '-getItem:JsonSchemaSegment', '-nologo'];
        const child = spawn(options.dotnetExecutablePath ?? 'dotnet', args, {
            cwd: path.dirname(projectPath),
            env: {
                ...process.env,
                // Long-lived MSBuild worker nodes would keep holding the project files open long
                // after the evaluation completes, which is not worth it for a single evaluation.
                MSBUILDDISABLENODEREUSE: '1',
                // Keep diagnostics that end up in the log channel readable regardless of the user's
                // configured CLI language.
                DOTNET_CLI_UI_LANGUAGE: 'en-US',
            },
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
        });

        let stdout = '';
        let stderr = '';
        let outputBytes = 0;
        let settled = false;
        let exited = false;
        let terminationRequested = false;
        let forceKillTimer: NodeJS.Timeout | undefined;

        const timeout = setTimeout(() => {
            terminateAndReject(
                new Error(
                    `dotnet msbuild evaluation for '${projectPath}' timed out after ${options.timeoutMilliseconds}ms.`
                )
            );
        }, options.timeoutMilliseconds);

        const onCancellation = () => {
            terminateAndReject(new Error(`dotnet msbuild evaluation for '${projectPath}' was cancelled.`));
        };
        options.signal?.addEventListener('abort', onCancellation, { once: true });

        const appendOutput = (chunk: Buffer | string, isStandardError: boolean) => {
            const text = chunk.toString();
            outputBytes += Buffer.byteLength(text);
            if (outputBytes > options.maxOutputBytes) {
                terminateAndReject(
                    new Error(
                        `dotnet msbuild evaluation for '${projectPath}' exceeded the ${options.maxOutputBytes}-byte output limit.`
                    )
                );
                return;
            }

            if (isStandardError) {
                stderr += text;
            } else {
                stdout += text;
            }
        };

        child.stdout?.on('data', (chunk: Buffer | string) => appendOutput(chunk, false));
        child.stderr?.on('data', (chunk: Buffer | string) => appendOutput(chunk, true));
        child.on('error', (error) => finish(() => reject(error)));
        child.on('close', (code) => {
            exited = true;
            if (forceKillTimer !== undefined) {
                clearTimeout(forceKillTimer);
                forceKillTimer = undefined;
            }

            if (code === 0) {
                finish(() => resolve(stdout));
            } else {
                const detail = stderr.trim();
                finish(() =>
                    reject(
                        new Error(
                            `dotnet msbuild evaluation for '${projectPath}' exited with code ${code ?? 'unknown'}${
                                detail.length > 0 ? `: ${detail}` : '.'
                            }`
                        )
                    )
                );
            }
        });

        function terminateAndReject(error: Error): void {
            if (terminationRequested) {
                return;
            }

            terminationRequested = true;
            try {
                child.kill();
            } catch {
                // The process may have already exited between the triggering event and cleanup.
            }

            // MSBuild ignores SIGTERM while it is writing its evaluation result, so escalate if the
            // child is still alive shortly afterwards. The timer is unref'd so it never keeps the
            // extension host event loop alive on shutdown.
            forceKillTimer = setTimeout(() => {
                if (!exited) {
                    try {
                        child.kill('SIGKILL');
                    } catch {
                        // The process exited after the check but before the forced termination.
                    }
                }
            }, forcedTerminationDelayMilliseconds);
            forceKillTimer.unref();
            finish(() => reject(error));
        }

        function finish(action: () => void): void {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            options.signal?.removeEventListener('abort', onCancellation);
            action();
        }
    });
}
