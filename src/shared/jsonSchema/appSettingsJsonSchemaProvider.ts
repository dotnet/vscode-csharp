/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { ChildProcess, SpawnOptions, spawn as spawnProcess } from 'child_process';
import {
    JsonSchemaSegment,
    JsonSchemaSegmentItemsResult,
    isAppSettingsSchemaPattern,
    mergeJsonSchemaSegments,
    parseJsonSchemaSegment,
    parseMsBuildJsonSchemaSegments,
} from './jsonSchemaSegments';

export const appSettingsJsonSchemaScheme = 'csharp-appsettings-schema';
export const appSettingsJsonSchemaUri = `${appSettingsJsonSchemaScheme}://schemas/appsettings.schema.json`;

export interface Disposable {
    dispose(): void;
}

export interface AppSettingsJsonSchemaProviderDependencies {
    isTrusted: boolean;
    workspaceFolderSchemes: readonly string[];
    findProjectPaths(): Promise<readonly string[]>;
    evaluateProject(projectPath: string, signal: AbortSignal): Promise<JsonSchemaSegmentItemsResult>;
    pathExists(schemaPath: string): Promise<boolean>;
    readFile(schemaPath: string): Promise<string>;
    watchWorkspaceInputs(listener: () => void): Disposable;
    watchSegmentFiles(paths: readonly string[], listener: () => void): Disposable;
    log(level: 'debug' | 'warn', message: string): void;
}

export interface AppSettingsJsonSchemaProviderOptions {
    debounceMilliseconds?: number;
}

export interface DotnetMsBuildOptions {
    spawn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
    timeoutMilliseconds: number;
    maxOutputBytes: number;
    signal?: AbortSignal;
}

const evaluationTimeoutMilliseconds = 15_000;
const maximumEvaluationOutputBytes = 4 * 1024 * 1024;

export class AppSettingsJsonSchemaProvider implements Disposable {
    private readonly debounceMilliseconds: number;
    private readonly listeners = new Set<(uri: string) => unknown>();
    private readonly workspaceWatcher?: Disposable;
    private segmentWatcher?: Disposable;
    private watchedSegmentPaths = '';
    private cachedContent?: string;
    private inFlight?: Promise<string>;
    private evaluationCancellation?: AbortController;
    private invalidationTimer?: NodeJS.Timeout;
    private generation = 0;
    private disposed = false;

    public constructor(
        private readonly dependencies: AppSettingsJsonSchemaProviderDependencies,
        options: AppSettingsJsonSchemaProviderOptions = {}
    ) {
        this.debounceMilliseconds = options.debounceMilliseconds ?? 250;
        if (this.canEvaluate()) {
            this.workspaceWatcher = dependencies.watchWorkspaceInputs(() => this.scheduleInvalidation());
        }
    }

    public readonly onDidChange = (listener: (uri: string) => unknown): Disposable => {
        this.listeners.add(listener);
        return {
            dispose: () => this.listeners.delete(listener),
        };
    };

    public async getSchemaContent(signal?: AbortSignal): Promise<string> {
        if (this.disposed || !this.canEvaluate() || signal?.aborted) {
            return createSchemaContent([]);
        }

        if (this.cachedContent !== undefined) {
            return this.cachedContent;
        }

        if (this.inFlight !== undefined) {
            return await this.waitForInFlightEvaluation(this.inFlight, signal);
        }

        const generation = this.generation;
        const cancellation = new AbortController();
        this.evaluationCancellation = cancellation;
        const cancel = () => cancellation.abort();
        signal?.addEventListener('abort', cancel, { once: true });

        const evaluation = this.loadSchemaContent(cancellation.signal)
            .catch((error) => {
                if (!cancellation.signal.aborted) {
                    this.dependencies.log(
                        'warn',
                        `Unable to load appsettings JSON schema segments: ${getErrorMessage(error)}`
                    );
                }
                return createSchemaContent([]);
            })
            .then((content) => {
                if (!this.disposed && !cancellation.signal.aborted && generation === this.generation) {
                    this.cachedContent = content;
                }
                return content;
            })
            .finally(() => {
                signal?.removeEventListener('abort', cancel);
                if (this.evaluationCancellation === cancellation) {
                    this.evaluationCancellation = undefined;
                }
                if (this.inFlight === evaluation) {
                    this.inFlight = undefined;
                }
            });

        this.inFlight = evaluation;
        return evaluation;
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.generation++;
        if (this.invalidationTimer !== undefined) {
            clearTimeout(this.invalidationTimer);
            this.invalidationTimer = undefined;
        }
        this.evaluationCancellation?.abort();
        this.workspaceWatcher?.dispose();
        this.segmentWatcher?.dispose();
        this.listeners.clear();
    }

    private canEvaluate(): boolean {
        return (
            this.dependencies.isTrusted &&
            this.dependencies.workspaceFolderSchemes.length > 0 &&
            this.dependencies.workspaceFolderSchemes.every((scheme) => scheme === 'file')
        );
    }

    private async waitForInFlightEvaluation(evaluation: Promise<string>, signal?: AbortSignal): Promise<string> {
        if (signal === undefined) {
            return await evaluation;
        }

        const cancel = () => this.evaluationCancellation?.abort();
        signal.addEventListener('abort', cancel, { once: true });
        try {
            return await evaluation;
        } finally {
            signal.removeEventListener('abort', cancel);
        }
    }

    private async loadSchemaContent(signal: AbortSignal): Promise<string> {
        // VS Code requests the schema URI without identifying the appsettings document that triggered validation.
        // Until that association includes the target document, merge segments from every project in the workspace.
        const projects = [...new Set(await this.dependencies.findProjectPaths())].sort(compareOrdinal);
        const items = [];
        for (const project of projects) {
            if (signal.aborted) {
                break;
            }

            try {
                const result = await this.dependencies.evaluateProject(project, signal);
                for (const diagnostic of result.diagnostics) {
                    this.dependencies.log('warn', diagnostic);
                }
                items.push(...result.segments.filter((segment) => isAppSettingsSchemaPattern(segment.filePathPattern)));
            } catch (error) {
                if (!signal.aborted) {
                    this.dependencies.log(
                        'warn',
                        `Unable to evaluate JsonSchemaSegment items for '${project}': ${getErrorMessage(error)}`
                    );
                }
            }
        }

        const segmentPaths = [...new Set(items.map((item) => path.normalize(item.path)))].sort(compareOrdinal);
        const segments: JsonSchemaSegment[] = [];
        for (const schemaPath of segmentPaths) {
            if (signal.aborted) {
                break;
            }

            try {
                if (!(await this.dependencies.pathExists(schemaPath))) {
                    this.dependencies.log('warn', `JSON schema segment '${schemaPath}' does not exist.`);
                    continue;
                }

                const parsed = parseJsonSchemaSegment(schemaPath, await this.dependencies.readFile(schemaPath));
                if (parsed.schema === undefined) {
                    this.dependencies.log('warn', parsed.diagnostic ?? `Unable to parse '${schemaPath}'.`);
                    continue;
                }

                segments.push({ path: schemaPath, schema: parsed.schema });
            } catch (error) {
                this.dependencies.log(
                    'warn',
                    `Unable to read JSON schema segment '${schemaPath}': ${getErrorMessage(error)}`
                );
            }
        }

        if (signal.aborted) {
            return createSchemaContent([]);
        }

        this.updateSegmentWatcher(segmentPaths);
        const merged = mergeJsonSchemaSegments(segments);
        for (const conflict of merged.conflicts) {
            this.dependencies.log(
                'warn',
                `Conflicting JSON schema value at '${conflict.path}' from '${conflict.ignoredSource}'. Keeping the value from '${conflict.keptSource}' because segment paths are merged in ordinal order.`
            );
        }

        return `${JSON.stringify(merged.schema, null, 2)}\n`;
    }

    private updateSegmentWatcher(segmentPaths: readonly string[]): void {
        const watchedSegmentPaths = JSON.stringify(segmentPaths);
        if (watchedSegmentPaths === this.watchedSegmentPaths) {
            return;
        }

        this.segmentWatcher?.dispose();
        this.segmentWatcher =
            segmentPaths.length > 0
                ? this.dependencies.watchSegmentFiles(segmentPaths, () => this.scheduleInvalidation())
                : undefined;
        this.watchedSegmentPaths = watchedSegmentPaths;
    }

    private scheduleInvalidation(): void {
        if (this.disposed) {
            return;
        }

        if (this.invalidationTimer !== undefined) {
            clearTimeout(this.invalidationTimer);
        }

        this.invalidationTimer = setTimeout(() => {
            this.invalidationTimer = undefined;
            this.generation++;
            this.cachedContent = undefined;
            this.inFlight = undefined;
            this.evaluationCancellation?.abort();
            for (const listener of this.listeners) {
                listener(appSettingsJsonSchemaUri);
            }
        }, this.debounceMilliseconds);
    }
}

export function registerAppSettingsJsonSchemaProvider(outputChannel: vscode.LogOutputChannel): vscode.Disposable {
    const schemaUri = vscode.Uri.parse(appSettingsJsonSchemaUri);
    const provider = new AppSettingsJsonSchemaProvider({
        get isTrusted() {
            return vscode.workspace.isTrusted;
        },
        get workspaceFolderSchemes() {
            return vscode.workspace.workspaceFolders?.map((folder) => folder.uri.scheme) ?? [];
        },
        findProjectPaths: async () => {
            const projects = await vscode.workspace.findFiles('**/*.csproj', '**/{bin,obj,node_modules}/**');
            return projects.map((project) => project.fsPath);
        },
        evaluateProject: async (projectPath, signal) => {
            const output = await runDotnetMsBuild(projectPath, {
                timeoutMilliseconds: evaluationTimeoutMilliseconds,
                maxOutputBytes: maximumEvaluationOutputBytes,
                signal,
            });
            return parseMsBuildJsonSchemaSegments(output, projectPath);
        },
        pathExists: async (schemaPath) => {
            try {
                return (await fs.stat(schemaPath)).isFile();
            } catch {
                return false;
            }
        },
        readFile: async (schemaPath) => await fs.readFile(schemaPath, 'utf8'),
        watchWorkspaceInputs: (listener) =>
            vscode.Disposable.from(
                createFileWatchers(['**/*.csproj', '**/Directory.*', '**/project.assets.json'], listener),
                vscode.workspace.onDidChangeWorkspaceFolders(listener)
            ),
        watchSegmentFiles: (paths, listener) =>
            createFileWatchers(
                paths.map(
                    (schemaPath) =>
                        new vscode.RelativePattern(vscode.Uri.file(path.dirname(schemaPath)), path.basename(schemaPath))
                ),
                listener
            ),
        log: (level, message) => outputChannel[level](message),
    });
    const changeEmitter = new vscode.EventEmitter<vscode.Uri>();
    const changeSubscription = provider.onDidChange(() => changeEmitter.fire(schemaUri));
    const registration = vscode.workspace.registerTextDocumentContentProvider(appSettingsJsonSchemaScheme, {
        onDidChange: changeEmitter.event,
        provideTextDocumentContent: async (_uri, token) => {
            const cancellation = new AbortController();
            const cancellationSubscription = token.onCancellationRequested(() => cancellation.abort());
            try {
                return await provider.getSchemaContent(cancellation.signal);
            } finally {
                cancellationSubscription.dispose();
            }
        },
    });

    return vscode.Disposable.from(provider, changeEmitter, changeSubscription, registration);
}

export async function runDotnetMsBuild(projectPath: string, options: DotnetMsBuildOptions): Promise<string> {
    return new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
            reject(new Error(`dotnet msbuild evaluation for '${projectPath}' was cancelled.`));
            return;
        }

        const spawn = options.spawn ?? spawnProcess;
        const args = ['msbuild', projectPath, '-getItem:JsonSchemaSegment', '-nologo'];
        const child = spawn('dotnet', args, {
            cwd: path.dirname(projectPath),
            env: {
                ...process.env,
                MSBUILDDISABLENODEREUSE: '1',
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
            forceKillTimer = setTimeout(() => {
                if (!exited) {
                    try {
                        child.kill('SIGKILL');
                    } catch {
                        // The process exited after the check but before the forced termination.
                    }
                }
            }, 1_000);
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

function createFileWatchers(patterns: readonly vscode.GlobPattern[], listener: () => void): vscode.Disposable {
    const disposables: vscode.Disposable[] = [];
    for (const pattern of patterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        disposables.push(
            watcher,
            watcher.onDidCreate(listener),
            watcher.onDidChange(listener),
            watcher.onDidDelete(listener)
        );
    }

    return vscode.Disposable.from(...disposables);
}

function createSchemaContent(segments: readonly JsonSchemaSegment[]): string {
    return `${JSON.stringify(mergeJsonSchemaSegments(segments).schema, null, 2)}\n`;
}

function compareOrdinal(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
