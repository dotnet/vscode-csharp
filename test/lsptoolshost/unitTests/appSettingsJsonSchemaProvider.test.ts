/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import {
    AppSettingsDocument,
    AppSettingsJsonSchemaProvider,
    AppSettingsJsonSchemaProviderDependencies,
    appSettingsJsonSchemaUri,
} from '../../../src/shared/jsonSchema/appSettingsJsonSchemaProvider';
import { JsonSchemaSegmentItem } from '../../../src/shared/jsonSchema/jsonSchemaSegments';

const appProjectPath = path.resolve('src', 'app', 'app.csproj');
const libProjectPath = path.resolve('src', 'lib', 'lib.csproj');
const aspireSegmentPath = path.resolve('packages', 'aspire.npgsql', 'ConfigurationSchema.json');
const yarpSegmentPath = path.resolve('packages', 'yarp', 'ConfigurationSchema.json');

const appSettings = createDocument('src/app', 'appsettings.json');
const appDevelopmentSettings = createDocument('src/app', 'appsettings.Development.json');
const libSettings = createDocument('src/lib', 'appsettings.json');

describe('AppSettingsJsonSchemaProvider', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('returns the neutral schema and evaluates nothing in an untrusted workspace', async () => {
        const environment = createEnvironment({ isTrusted: false, documents: [appSettings] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        expect(JSON.parse(await provider.getSchemaContent())).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
        });
        expect(environment.dependencies.findOwningProject).not.toHaveBeenCalled();
        expect(environment.dependencies.evaluateProject).not.toHaveBeenCalled();
        provider.dispose();
    });

    test('evaluates once the workspace becomes trusted', async () => {
        jest.useFakeTimers();
        const environment = createEnvironment({ isTrusted: false });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);
        const changed = jest.fn();
        provider.onDidChange(changed);

        expect(JSON.parse(await provider.getSchemaContent())).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
        });

        // Granting trust surfaces as a project input change, which must invalidate the refusal
        // rather than leave the neutral schema in place for the rest of the session.
        environment.setTrusted(true);
        environment.fireProjectChange();
        await jest.advanceTimersByTimeAsync(250);
        expect(changed).toHaveBeenCalledWith('csharp-appsettings-schema://schemas/appsettings.schema.json');

        const schema = JSON.parse(await provider.getSchemaContent());
        expect(schema.properties).toEqual({ Aspire: { type: 'object' } });
        provider.dispose();
    });

    test('evaluates nothing until an appsettings document is open', async () => {
        const environment = createEnvironment({ documents: [] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        expect(JSON.parse(await provider.getSchemaContent())).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
        });
        expect(environment.dependencies.evaluateProject).not.toHaveBeenCalled();
        provider.dispose();
    });

    test('routes an open document to the project that owns it', async () => {
        const environment = createEnvironment({ documents: [appSettings] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const schema = JSON.parse(await provider.getSchemaContent());

        expect(schema.properties).toEqual({ Aspire: { type: 'object' } });
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(1);
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledWith(appProjectPath, expect.anything());
        provider.dispose();
    });

    test('only applies segments whose FilePathPattern matches the open document name', async () => {
        const environment = createEnvironment({
            documents: [appDevelopmentSettings],
            segmentsByProject: {
                [appProjectPath]: [
                    { path: aspireSegmentPath, filePathPattern: 'appsettings\\.json' },
                    { path: yarpSegmentPath, filePathPattern: 'appsettings\\..*json' },
                ],
            },
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const schema = JSON.parse(await provider.getSchemaContent());

        expect(schema.properties).toEqual({ ReverseProxy: { type: 'object' } });
        expect(environment.dependencies.readSegment).toHaveBeenCalledTimes(1);
        expect(environment.dependencies.readSegment).toHaveBeenCalledWith(yarpSegmentPath);
        provider.dispose();
    });

    test('unions the owning projects when documents from several projects are open', async () => {
        const environment = createEnvironment({ documents: [appSettings, libSettings] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const schema = JSON.parse(await provider.getSchemaContent());

        expect(schema.properties).toEqual({ Aspire: { type: 'object' }, ReverseProxy: { type: 'object' } });
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(2);
        provider.dispose();
    });

    test('skips documents that are not backed by the local file system', async () => {
        const environment = createEnvironment({
            documents: [{ ...appSettings, scheme: 'vscode-vfs' }],
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        expect(JSON.parse(await provider.getSchemaContent())).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
        });
        expect(environment.dependencies.findOwningProject).not.toHaveBeenCalled();
        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'debug',
            expect.stringContaining('scheme is not supported')
        );
        provider.dispose();
    });

    test('skips a document that no project owns', async () => {
        const environment = createEnvironment({
            documents: [createDocument('docs', 'appsettings.json')],
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        expect(JSON.parse(await provider.getSchemaContent())).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
        });
        expect(environment.dependencies.evaluateProject).not.toHaveBeenCalled();
        provider.dispose();
    });

    test('caches the composed schema and reuses evaluated project items', async () => {
        const environment = createEnvironment({ documents: [appSettings] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const first = await provider.getSchemaContent();
        const second = await provider.getSchemaContent();

        expect(second).toBe(first);
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(1);
        expect(environment.dependencies.readSegment).toHaveBeenCalledTimes(1);
        provider.dispose();
    });

    test('recomposes without re-evaluating when the open documents change', async () => {
        jest.useFakeTimers();
        const environment = createEnvironment({ documents: [appSettings] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies, { debounceMilliseconds: 25 });
        const changed = jest.fn();
        provider.onDidChange(changed);

        await provider.getSchemaContent();
        environment.setDocuments([appSettings, libSettings]);
        environment.fireDocumentChange();
        await jest.advanceTimersByTimeAsync(25);

        expect(changed).toHaveBeenCalledWith(appSettingsJsonSchemaUri);
        const schema = JSON.parse(await provider.getSchemaContent());
        expect(schema.properties).toEqual({ Aspire: { type: 'object' }, ReverseProxy: { type: 'object' } });
        // The already evaluated project is reused; only the newly routed project is evaluated.
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(2);
        provider.dispose();
    });

    test('ignores a document change that does not affect routing', async () => {
        jest.useFakeTimers();
        const environment = createEnvironment({ documents: [appSettings] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies, { debounceMilliseconds: 25 });
        const changed = jest.fn();
        provider.onDidChange(changed);

        await provider.getSchemaContent();
        // The same file opened in a second editor group produces another document with the same
        // name in the same directory, which routes identically.
        environment.setDocuments([appSettings, { ...appSettings, id: `${appSettings.id}#2` }]);
        environment.fireDocumentChange();
        await jest.advanceTimersByTimeAsync(25);

        expect(changed).not.toHaveBeenCalled();
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(1);
        provider.dispose();
    });

    test('debounces project changes and re-evaluates the affected project once', async () => {
        jest.useFakeTimers();
        const environment = createEnvironment({ documents: [appSettings] });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies, { debounceMilliseconds: 25 });
        const changed = jest.fn();
        provider.onDidChange(changed);

        await provider.getSchemaContent();
        environment.fireProjectChange();
        environment.fireProjectChange();
        environment.fireSegmentChange();

        expect(changed).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(25);
        await provider.getSchemaContent();

        expect(changed).toHaveBeenCalledTimes(1);
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(2);
        expect(environment.dependencies.watchSegmentFiles).toHaveBeenLastCalledWith(
            [aspireSegmentPath],
            expect.any(Function)
        );
        provider.dispose();
    });

    test('logs each distinct diagnostic once', async () => {
        const environment = createEnvironment({
            documents: [appSettings],
            segmentsByProject: {
                [appProjectPath]: [
                    { path: aspireSegmentPath, filePathPattern: 'appsettings\\..*json' },
                    { path: yarpSegmentPath, filePathPattern: 'appsettings(.+)+\\.json' },
                ],
            },
            diagnostics: ['ignored malformed MSBuild item'],
            readSegment: jest.fn(async (segmentPath: string) =>
                segmentPath === aspireSegmentPath ? '{ "type": }' : undefined
            ),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies, { debounceMilliseconds: 0 });

        await provider.getSchemaContent();
        environment.fireSegmentChange();
        await provider.getSchemaContent();

        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'warn',
            expect.stringContaining('ignored malformed MSBuild item')
        );
        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'warn',
            expect.stringContaining('unsupported regular expression syntax')
        );
        expect(environment.dependencies.log).toHaveBeenCalledWith(
            'warn',
            expect.stringContaining('Unable to parse JSON schema segment')
        );
        expect(new Set(environment.dependencies.log.mock.calls.map(([, message]) => message)).size).toBe(
            environment.dependencies.log.mock.calls.length
        );
        provider.dispose();
    });

    test('keeps usable segments when a project evaluation fails', async () => {
        const environment = createEnvironment({
            documents: [appSettings, libSettings],
            evaluateProject: jest.fn(async (projectPath: string) => {
                if (projectPath === appProjectPath) {
                    throw new Error('MSBuild failed');
                }

                return {
                    segments: [{ path: yarpSegmentPath, filePathPattern: 'appsettings\\..*json' }],
                    diagnostics: [],
                };
            }),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const schema = JSON.parse(await provider.getSchemaContent());

        expect(schema.properties).toEqual({ ReverseProxy: { type: 'object' } });
        expect(environment.dependencies.log).toHaveBeenCalledWith('warn', expect.stringContaining('MSBuild failed'));
        provider.dispose();
    });

    test('does not remember a failed evaluation as an empty result', async () => {
        const evaluateProject = jest
            .fn<AppSettingsJsonSchemaProviderDependencies['evaluateProject']>()
            .mockRejectedValueOnce(new Error('MSBuild failed'))
            .mockResolvedValue({
                segments: [{ path: aspireSegmentPath, filePathPattern: 'appsettings\\..*json' }],
                diagnostics: [],
            });
        const environment = createEnvironment({ documents: [appSettings], evaluateProject });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        await provider.getSchemaContent();
        environment.setDocuments([appSettings, libSettings]);
        const schema = JSON.parse(await provider.getSchemaContent());

        expect(schema.properties).toEqual({ Aspire: { type: 'object' } });
        provider.dispose();
    });

    test('does not cache the neutral schema returned for a cancelled request', async () => {
        const evaluationStarted = createDeferred<void>();
        const evaluateProject = jest
            .fn<AppSettingsJsonSchemaProviderDependencies['evaluateProject']>()
            .mockImplementationOnce(
                async (_projectPath, signal) =>
                    await new Promise<never>((_, reject) => {
                        evaluationStarted.resolve(undefined);
                        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
                    })
            )
            .mockResolvedValue({
                segments: [{ path: aspireSegmentPath, filePathPattern: 'appsettings\\..*json' }],
                diagnostics: [],
            });
        const environment = createEnvironment({ documents: [appSettings], evaluateProject });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);
        const cancellation = new AbortController();

        const cancelled = provider.getSchemaContent(cancellation.signal);
        await evaluationStarted.promise;
        cancellation.abort();

        expect(JSON.parse(await cancelled)).toEqual({ $schema: 'http://json-schema.org/draft-07/schema#' });
        const schema = JSON.parse(await provider.getSchemaContent());
        expect(schema.properties).toEqual({ Aspire: { type: 'object' } });
        provider.dispose();
    });

    test('keeps shared work alive while another requester is still waiting', async () => {
        const evaluationStarted = createDeferred<void>();
        const finishEvaluation = createDeferred<void>();
        let evaluationWasCancelled = false;
        const environment = createEnvironment({
            documents: [appSettings],
            evaluateProject: jest.fn(async (_projectPath: string, signal: AbortSignal) => {
                evaluationStarted.resolve(undefined);
                signal.addEventListener('abort', () => (evaluationWasCancelled = true), { once: true });
                await finishEvaluation.promise;
                return {
                    segments: [{ path: aspireSegmentPath, filePathPattern: 'appsettings\\..*json' }],
                    diagnostics: [],
                };
            }),
        });
        const provider = new AppSettingsJsonSchemaProvider(environment.dependencies);

        const cancellation = new AbortController();
        const cancelledRequest = provider.getSchemaContent(cancellation.signal);
        const survivingRequest = provider.getSchemaContent();
        await evaluationStarted.promise;
        cancellation.abort();
        finishEvaluation.resolve(undefined);

        expect(evaluationWasCancelled).toBe(false);
        expect(JSON.parse(await survivingRequest).properties).toEqual({ Aspire: { type: 'object' } });
        expect(JSON.parse(await cancelledRequest).properties).toEqual({ Aspire: { type: 'object' } });
        expect(environment.dependencies.evaluateProject).toHaveBeenCalledTimes(1);
        provider.dispose();
    });

    test('cancels shared work once every requester has gone away', async () => {
        const evaluationStarted = createDeferred<void>();
        let evaluationWasCancelled = false;
        const environment = createEnvironment({
            documents: [appSettings],
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

        const first = new AbortController();
        const second = new AbortController();
        const firstRequest = provider.getSchemaContent(first.signal);
        const secondRequest = provider.getSchemaContent(second.signal);
        await evaluationStarted.promise;

        first.abort();
        expect(evaluationWasCancelled).toBe(false);

        second.abort();
        expect(evaluationWasCancelled).toBe(true);
        expect(JSON.parse(await firstRequest)).toEqual({ $schema: 'http://json-schema.org/draft-07/schema#' });
        expect(JSON.parse(await secondRequest)).toEqual({ $schema: 'http://json-schema.org/draft-07/schema#' });
        provider.dispose();
    });

    test('disposal aborts in-flight work and releases every watcher', async () => {
        const evaluationStarted = createDeferred<void>();
        const environment = createEnvironment({
            documents: [appSettings],
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

        expect(JSON.parse(await content)).toEqual({ $schema: 'http://json-schema.org/draft-07/schema#' });
        expect(environment.projectWatcher.dispose).toHaveBeenCalledTimes(1);
        expect(environment.documentWatcher.dispose).toHaveBeenCalledTimes(1);
        expect(JSON.parse(await provider.getSchemaContent())).toEqual({
            $schema: 'http://json-schema.org/draft-07/schema#',
        });
    });
});

interface EnvironmentOverrides {
    isTrusted?: boolean;
    documents?: readonly AppSettingsDocument[];
    segmentsByProject?: Record<string, JsonSchemaSegmentItem[]>;
    diagnostics?: string[];
    evaluateProject?: AppSettingsJsonSchemaProviderDependencies['evaluateProject'];
    readSegment?: AppSettingsJsonSchemaProviderDependencies['readSegment'];
}

interface Environment {
    dependencies: AppSettingsJsonSchemaProviderDependencies & {
        findOwningProject: jest.MockedFunction<AppSettingsJsonSchemaProviderDependencies['findOwningProject']>;
        evaluateProject: jest.MockedFunction<AppSettingsJsonSchemaProviderDependencies['evaluateProject']>;
        readSegment: jest.MockedFunction<AppSettingsJsonSchemaProviderDependencies['readSegment']>;
        watchSegmentFiles: jest.MockedFunction<AppSettingsJsonSchemaProviderDependencies['watchSegmentFiles']>;
        log: jest.MockedFunction<AppSettingsJsonSchemaProviderDependencies['log']>;
    };
    projectWatcher: { dispose: jest.MockedFunction<() => void> };
    documentWatcher: { dispose: jest.MockedFunction<() => void> };
    setDocuments(documents: readonly AppSettingsDocument[]): void;
    setTrusted(isTrusted: boolean): void;
    fireProjectChange(): void;
    fireSegmentChange(): void;
    fireDocumentChange(): void;
}

const defaultSegmentContent: Record<string, string> = {
    [aspireSegmentPath]: '{ "type": "object", "properties": { "Aspire": { "type": "object" } } }',
    [yarpSegmentPath]: '{ "type": "object", "properties": { "ReverseProxy": { "type": "object" } } }',
};

function createEnvironment(overrides: EnvironmentOverrides = {}): Environment {
    let documents = overrides.documents ?? [appSettings];
    let isTrusted = overrides.isTrusted ?? true;
    let projectChange = () => {};
    let segmentChange = () => {};
    let documentChange = () => {};
    const projectWatcher = { dispose: jest.fn() };
    const documentWatcher = { dispose: jest.fn() };
    const segmentWatcher = { dispose: jest.fn() };
    const segmentsByProject = overrides.segmentsByProject ?? {
        [appProjectPath]: [{ path: aspireSegmentPath, filePathPattern: 'appsettings\\..*json' }],
        [libProjectPath]: [{ path: yarpSegmentPath, filePathPattern: 'appsettings\\..*json' }],
    };

    const dependencies = {
        get isTrusted() {
            return isTrusted;
        },
        getAppSettingsDocuments: () => documents,
        findOwningProject: jest.fn(async (document: AppSettingsDocument) => {
            if (document.directory.endsWith('src/app')) {
                return appProjectPath;
            }

            return document.directory.endsWith('src/lib') ? libProjectPath : undefined;
        }),
        evaluateProject:
            overrides.evaluateProject ??
            jest.fn(async (projectPath: string) => ({
                segments: segmentsByProject[projectPath] ?? [],
                diagnostics: overrides.diagnostics ?? [],
            })),
        readSegment:
            overrides.readSegment ?? jest.fn(async (segmentPath: string) => defaultSegmentContent[segmentPath]),
        watchProjectInputs: jest.fn((listener: () => void) => {
            projectChange = listener;
            return projectWatcher;
        }),
        watchSegmentFiles: jest.fn((_segmentPaths: readonly string[], listener: () => void) => {
            segmentChange = listener;
            return segmentWatcher;
        }),
        watchAppSettingsDocuments: jest.fn((listener: () => void) => {
            documentChange = listener;
            return documentWatcher;
        }),
        log: jest.fn(),
    } as unknown as Environment['dependencies'];

    return {
        dependencies,
        projectWatcher,
        documentWatcher,
        setDocuments: (value) => (documents = value),
        setTrusted: (value) => (isTrusted = value),
        fireProjectChange: () => projectChange(),
        fireSegmentChange: () => segmentChange(),
        fireDocumentChange: () => documentChange(),
    };
}

function createDocument(directory: string, fileName: string): AppSettingsDocument {
    return {
        id: `file:///workspace/${directory}/${fileName}`,
        fileName,
        directory: `file:///workspace/${directory}`,
        scheme: 'file',
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
