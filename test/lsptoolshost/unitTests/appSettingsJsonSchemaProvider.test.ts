/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { ChildProcess, SpawnOptions } from 'child_process';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import {
    AppSettingsJsonSchemaProvider,
    AppSettingsJsonSchemaProviderDependencies,
    appSettingsJsonSchemaUri,
    runDotnetMsBuild,
} from '../../../src/shared/jsonSchema/appSettingsJsonSchemaProvider';

describe('dotnet msbuild JSON schema evaluation', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('spawns dotnet with an argument array and no shell', async () => {
        const child = createChildProcess();
        const spawn = jest.fn((_command: string, _args: readonly string[], _options: SpawnOptions) => child);
        const projectPath = path.resolve('workspace with spaces', 'project;echo-not-a-command.csproj');
        const promise = runDotnetMsBuild(projectPath, {
            spawn,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 1_024,
        });

        child.stdout!.emit('data', Buffer.from('{"Items":{"JsonSchemaSegment":[]}}'));
        child.emit('close', 0, null);

        await expect(promise).resolves.toBe('{"Items":{"JsonSchemaSegment":[]}}');
        expect(spawn).toHaveBeenCalledWith(
            'dotnet',
            ['msbuild', projectPath, '-getItem:JsonSchemaSegment', '-nologo'],
            expect.objectContaining({
                cwd: path.dirname(projectPath),
                shell: false,
                windowsHide: true,
                env: expect.objectContaining({
                    MSBUILDDISABLENODEREUSE: '1',
                }),
            })
        );
    });

    test('kills evaluation when output exceeds the configured bound', async () => {
        const child = createChildProcess();
        const promise = runDotnetMsBuild(path.resolve('app.csproj'), {
            spawn: () => child,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 4,
        });

        child.stdout!.emit('data', Buffer.from('12345'));

        await expect(promise).rejects.toThrow('output limit');
        expect(child.kill).toHaveBeenCalledTimes(1);
    });

    test('kills evaluation when it times out or is cancelled', async () => {
        jest.useFakeTimers();
        const timedOutChild = createChildProcess();
        const timedOut = runDotnetMsBuild(path.resolve('timeout.csproj'), {
            spawn: () => timedOutChild,
            timeoutMilliseconds: 50,
            maxOutputBytes: 1_024,
        });
        const timedOutExpectation = expect(timedOut).rejects.toThrow('timed out');

        await jest.advanceTimersByTimeAsync(50);

        await timedOutExpectation;
        expect(timedOutChild.kill).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1_000);
        expect(timedOutChild.kill).toHaveBeenLastCalledWith('SIGKILL');

        const cancelledChild = createChildProcess();
        const cancellation = new AbortController();
        const cancelled = runDotnetMsBuild(path.resolve('cancelled.csproj'), {
            spawn: () => cancelledChild,
            timeoutMilliseconds: 1_000,
            maxOutputBytes: 1_024,
            signal: cancellation.signal,
        });
        const cancelledExpectation = expect(cancelled).rejects.toThrow('cancelled');

        cancellation.abort();

        await cancelledExpectation;
        expect(cancelledChild.kill).toHaveBeenCalledTimes(1);
    });
});

describe('AppSettingsJsonSchemaProvider', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test.each([
        ['untrusted', false, ['file']],
        ['virtual', true, ['vscode-vfs']],
        ['mixed local and virtual', true, ['file', 'vscode-vfs']],
    ])('returns the SchemaStore fallback without evaluating an %s workspace', async (_name, isTrusted, schemes) => {
        const environment = createProviderDependencies({
            isTrusted,
            workspaceFolderSchemes: schemes,
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const content = await provider.getSchemaContent();

        expect(JSON.parse(content)).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
            allOf: [{ $ref: 'https://json.schemastore.org/appsettings' }],
        });
        expect(environment.dependencies.findProjectPaths).not.toHaveBeenCalled();
        expect(environment.dependencies.watchWorkspaceInputs).not.toHaveBeenCalled();
        provider.dispose();
    });

    test('rechecks workspace locality before starting evaluation', async () => {
        const workspaceFolderSchemes = ['file'];
        const environment = createProviderDependencies({ workspaceFolderSchemes });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);
        workspaceFolderSchemes.push('vscode-vfs');

        await provider.getSchemaContent();

        expect(environment.dependencies.findProjectPaths).not.toHaveBeenCalled();
        expect(environment.dependencies.evaluateProject).not.toHaveBeenCalled();
        provider.dispose();
    });

    test('caches content and debounces invalidation from workspace and segment changes', async () => {
        jest.useFakeTimers();
        const schemaPath = path.resolve('schemas', 'aspire.schema.json');
        const environment = createProviderDependencies({
            evaluateProject: jest.fn(async () => ({
                segments: [{ path: schemaPath, filePathPattern: 'appsettings\\..*json' }],
                diagnostics: [],
            })),
            pathExists: jest.fn(async () => true),
            readFile: jest.fn(async () => '{ "type": "object", "properties": { "Aspire": { "type": "object" } } }'),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies, {
            debounceMilliseconds: 25,
        });
        const changed = jest.fn();
        provider.onDidChange(changed);

        const first = await provider.getSchemaContent();
        const second = await provider.getSchemaContent();
        environment.fireWorkspaceChange();
        environment.fireWorkspaceChange();
        environment.fireSegmentChange();

        expect(second).toBe(first);
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(1);
        expect(changed).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(25);
        const refreshed = await provider.getSchemaContent();

        expect(refreshed).toBe(first);
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(2);
        expect(environment.dependencies.watchSegmentFiles).toHaveBeenLastCalledWith([schemaPath], expect.any(Function));
        expect(changed).toHaveBeenCalledWith(appSettingsJsonSchemaUri);
        provider.dispose();
        expect(environment.workspaceWatcher.dispose).toHaveBeenCalledTimes(1);
        expect(environment.segmentWatcher.dispose).toHaveBeenCalledTimes(1);
    });

    test('logs project and segment failures while retaining valid schema content', async () => {
        const validPath = path.resolve('schemas', 'valid.schema.json');
        const malformedPath = path.resolve('schemas', 'malformed.schema.json');
        const unreadablePath = path.resolve('schemas', 'unreadable.schema.json');
        const missingPath = path.resolve('schemas', 'missing.schema.json');
        const environment = createProviderDependencies({
            findProjectPaths: jest.fn(async () => [path.resolve('broken.csproj'), path.resolve('valid.csproj')]),
            evaluateProject: jest.fn(async (projectPath: string) => {
                if (projectPath.endsWith('broken.csproj')) {
                    throw new Error('MSBuild failed');
                }

                return {
                    segments: [
                        { path: validPath, filePathPattern: 'appsettings\\..*json' },
                        { path: malformedPath, filePathPattern: 'appsettings\\..*json' },
                        { path: unreadablePath, filePathPattern: 'appsettings\\..*json' },
                        { path: missingPath, filePathPattern: 'appsettings\\..*json' },
                        { path: path.resolve('launch.schema.json'), filePathPattern: 'launchSettings\\.json' },
                    ],
                    diagnostics: ['ignored malformed MSBuild item'],
                };
            }),
            pathExists: jest.fn(async (schemaPath: string) => schemaPath !== missingPath),
            readFile: jest.fn(async (schemaPath: string) => {
                if (schemaPath === malformedPath) {
                    return '{ "type": }';
                }
                if (schemaPath === unreadablePath) {
                    throw new Error('permission denied');
                }

                return '{ "type": "object", "properties": { "ReverseProxy": { "type": "object" } } }';
            }),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const content = JSON.parse(await provider.getSchemaContent());

        expect(content.properties.ReverseProxy).toEqual({ type: 'object' });
        expect(environment.dependencies.log).toHaveBeenCalledWith('warn', expect.stringContaining('MSBuild failed'));
        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'warn',
            expect.stringContaining('ignored malformed MSBuild item')
        );
        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'warn',
            expect.stringContaining('malformed.schema.json')
        );
        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'warn',
            expect.stringContaining('unreadable.schema.json')
        );
        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'warn',
            expect.stringContaining('missing.schema.json')
        );
        provider.dispose();
    });

    test('starts a fresh evaluation when invalidation reloads an in-flight schema', async () => {
        jest.useFakeTimers();
        const schemaPath = path.resolve('schemas', 'aspire.schema.json');
        const evaluationStarted = createDeferred<void>();
        const environment = createProviderDependencies({
            evaluateProject: jest
                .fn<AppSettingsJsonSchemaProviderDependencies['evaluateProject']>()
                .mockImplementationOnce(
                    async (_projectPath, signal) =>
                        await new Promise<never>((_, reject) => {
                            evaluationStarted.resolve(undefined);
                            signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
                        })
                )
                .mockResolvedValue({
                    segments: [{ path: schemaPath, filePathPattern: 'appsettings\\..*json' }],
                    diagnostics: [],
                }),
            pathExists: jest.fn(async () => true),
            readFile: jest.fn(async () => '{ "properties": { "Aspire": { "type": "object" } } }'),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies, {
            debounceMilliseconds: 25,
        });
        const firstContent = provider.getSchemaContent();
        await evaluationStarted.promise;
        let refreshedContent: Promise<string> | undefined;
        provider.onDidChange(() => {
            refreshedContent = provider.getSchemaContent();
        });

        environment.fireWorkspaceChange();
        await jest.advanceTimersByTimeAsync(25);

        await expect(firstContent).resolves.toContain('json.schemastore.org/appsettings');
        expect(JSON.parse(await refreshedContent!).properties.Aspire).toEqual({ type: 'object' });
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(2);
        provider.dispose();
    });

    test('does not cache the fallback returned for a cancelled request', async () => {
        const schemaPath = path.resolve('schemas', 'aspire.schema.json');
        const evaluationStarted = createDeferred<void>();
        const environment = createProviderDependencies({
            evaluateProject: jest
                .fn<AppSettingsJsonSchemaProviderDependencies['evaluateProject']>()
                .mockImplementationOnce(
                    async (_projectPath, signal) =>
                        await new Promise<never>((_, reject) => {
                            evaluationStarted.resolve(undefined);
                            signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
                        })
                )
                .mockResolvedValue({
                    segments: [{ path: schemaPath, filePathPattern: 'appsettings\\..*json' }],
                    diagnostics: [],
                }),
            pathExists: jest.fn(async () => true),
            readFile: jest.fn(async () => '{ "properties": { "Aspire": { "type": "object" } } }'),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);
        const cancellation = new AbortController();
        const cancelledContent = provider.getSchemaContent(cancellation.signal);
        await evaluationStarted.promise;

        cancellation.abort();
        await expect(cancelledContent).resolves.toContain('json.schemastore.org/appsettings');

        const refreshedContent = JSON.parse(await provider.getSchemaContent());

        expect(refreshedContent.properties.Aspire).toEqual({ type: 'object' });
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(2);
        provider.dispose();
    });

    test('cancels shared evaluation when a concurrent request is cancelled', async () => {
        const evaluationStarted = createDeferred<void>();
        let evaluationWasCancelled = false;
        const environment = createProviderDependencies({
            evaluateProject: jest.fn(
                async (_projectPath: string, signal: AbortSignal) =>
                    await new Promise<never>((_, reject) => {
                        evaluationStarted.resolve(undefined);
                        signal.addEventListener(
                            'abort',
                            () => {
                                evaluationWasCancelled = true;
                                reject(new Error('cancelled'));
                            },
                            { once: true }
                        );
                    })
            ),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);
        const firstContent = provider.getSchemaContent();
        await evaluationStarted.promise;
        const cancellation = new AbortController();
        const secondContent = provider.getSchemaContent(cancellation.signal);

        cancellation.abort();

        expect(evaluationWasCancelled).toBe(true);
        await expect(firstContent).resolves.toContain('json.schemastore.org/appsettings');
        await expect(secondContent).resolves.toContain('json.schemastore.org/appsettings');
        provider.dispose();
    });

    test('disposal aborts in-flight project evaluation', async () => {
        const evaluationStarted = createDeferred<void>();
        const environment = createProviderDependencies({
            evaluateProject: jest.fn(
                async (_projectPath: string, signal: AbortSignal) =>
                    await new Promise<never>((_, reject) => {
                        evaluationStarted.resolve(undefined);
                        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
                    })
            ),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);
        const content = provider.getSchemaContent();
        await evaluationStarted.promise;

        provider.dispose();

        await expect(content).resolves.toContain('json.schemastore.org/appsettings');
        expect(environment.workspaceWatcher.dispose).toHaveBeenCalledTimes(1);
    });
});

function createChildProcess(): ChildProcess & {
    kill: jest.MockedFunction<(signal?: NodeJS.Signals | number) => boolean>;
} {
    const child = new EventEmitter() as ChildProcess & {
        kill: jest.MockedFunction<(signal?: NodeJS.Signals | number) => boolean>;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = jest.fn(() => true);
    return child;
}

function createProviderDependencies(overrides: Partial<AppSettingsJsonSchemaProviderDependencies> = {}): {
    dependencies: AppSettingsJsonSchemaProviderDependencies;
    workspaceWatcher: { dispose: jest.MockedFunction<() => void> };
    segmentWatcher: { dispose: jest.MockedFunction<() => void> };
    fireWorkspaceChange: () => void;
    fireSegmentChange: () => void;
} {
    let workspaceChange = () => {};
    let segmentChange = () => {};
    const workspaceWatcher = { dispose: jest.fn() };
    const segmentWatcher = { dispose: jest.fn() };
    const dependencies: AppSettingsJsonSchemaProviderDependencies = {
        isTrusted: true,
        workspaceFolderSchemes: ['file'],
        findProjectPaths: jest.fn(async () => [path.resolve('app.csproj')]),
        evaluateProject: jest.fn(async () => ({
            segments: [],
            diagnostics: [],
        })),
        pathExists: jest.fn(async () => false),
        readFile: jest.fn(async () => ''),
        watchWorkspaceInputs: jest.fn((listener: () => void) => {
            workspaceChange = listener;
            return workspaceWatcher;
        }),
        watchSegmentFiles: jest.fn((_paths: readonly string[], listener: () => void) => {
            segmentChange = listener;
            return segmentWatcher;
        }),
        log: jest.fn(),
        ...overrides,
    };

    return {
        dependencies,
        workspaceWatcher,
        segmentWatcher,
        fireWorkspaceChange: () => workspaceChange(),
        fireSegmentChange: () => segmentChange(),
    };
}

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
} {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
    });
    return { promise, resolve };
}
