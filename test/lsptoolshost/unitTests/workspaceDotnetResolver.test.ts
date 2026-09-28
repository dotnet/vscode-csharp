/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { WorkspaceDotnetStateServiceV1, WorkspaceDotnetStateV1 } from '../../../src/csharpDevKitExports';
import { resolveWorkspaceDotnet } from '../../../src/lsptoolshost/dotnetRuntime/workspaceDotnetResolver';

describe('workspace .NET resolver', () => {
    test('uses standalone resolution when the service is absent or unsupported', async () => {
        await expect(resolveWorkspaceDotnet(undefined)).resolves.toBeUndefined();
        await expect(
            resolveWorkspaceDotnet({ version: '2.0' } as unknown as WorkspaceDotnetStateServiceV1)
        ).resolves.toBeUndefined();
    });

    test('uses exact ready metadata and applies the environment overlay', async () => {
        const originalDotnetRoot = process.env.DOTNET_ROOT;
        const originalPreservedValue = process.env.WORKSPACE_DOTNET_TEST_PRESERVED;
        process.env.DOTNET_ROOT = '/user/dotnet';
        process.env.WORKSPACE_DOTNET_TEST_PRESERVED = 'preserved';

        try {
            const service = createService({
                kind: 'ready',
                revision: 4,
                host: {
                    executablePath: '/workspace/dotnet',
                    architecture: 'arm64',
                    environment: {
                        DOTNET_ROOT: null,
                        WORKSPACE_DOTNET_TEST_ADDED: 'added',
                    },
                },
                sdk: {
                    path: '/workspace/sdk/10.0.100',
                    version: '10.0.100',
                },
            });

            const result = await resolveWorkspaceDotnet(service);

            expect(result).toMatchObject({
                host: {
                    path: '/workspace/dotnet',
                    version: '10.0.100',
                },
                dotnetInfo: {
                    CliPath: '/workspace/dotnet',
                    Version: '10.0.100',
                    Architecture: 'arm64',
                },
                sdk: {
                    path: '/workspace/sdk/10.0.100',
                    version: '10.0.100',
                },
            });
            expect(result?.host.env.DOTNET_ROOT).toBeUndefined();
            expect(result?.host.env.WORKSPACE_DOTNET_TEST_ADDED).toBe('added');
            expect(result?.host.env.WORKSPACE_DOTNET_TEST_PRESERVED).toBe('preserved');
            expect(service.disposed).toBe(true);
        } finally {
            setOrDeleteEnvironmentVariable('DOTNET_ROOT', originalDotnetRoot);
            setOrDeleteEnvironmentVariable('WORKSPACE_DOTNET_TEST_PRESERVED', originalPreservedValue);
            delete process.env.WORKSPACE_DOTNET_TEST_ADDED;
        }
    });

    test('subscribes before reading and waits for a newer ready state', async () => {
        const service = createService({ kind: 'resolving', revision: 2 });
        service.getState = jest.fn((): WorkspaceDotnetStateV1 => {
            expect(service.subscribed).toBe(true);
            queueMicrotask(() => {
                service.emit({ kind: 'notApplicable', revision: 1 });
                service.emit({
                    kind: 'ready',
                    revision: 3,
                    host: {
                        executablePath: '/workspace/dotnet',
                        architecture: 'x64',
                        environment: {},
                    },
                    sdk: {
                        path: '/workspace/sdk/9.0.300',
                        version: '9.0.300',
                    },
                });
            });
            return { kind: 'resolving', revision: 2 };
        });

        const result = await resolveWorkspaceDotnet(service, 1000);

        expect(result?.sdk.version).toBe('9.0.300');
        expect(service.disposed).toBe(true);
    });

    test('falls back only for notApplicable', async () => {
        const service = createService({ kind: 'notApplicable', revision: 1 });

        await expect(resolveWorkspaceDotnet(service)).resolves.toBeUndefined();
        expect(service.disposed).toBe(true);
    });

    test('fails closed for blocked, invalid, and timed out providers', async () => {
        await expect(resolveWorkspaceDotnet(createService({ kind: 'blocked', revision: 1 }))).rejects.toThrow(
            'blocked'
        );
        await expect(
            resolveWorkspaceDotnet(
                createService({
                    kind: 'ready',
                    revision: 1,
                    host: {
                        executablePath: '',
                        architecture: 'x64',
                        environment: {},
                    },
                    sdk: {
                        path: '/workspace/sdk/9.0.300',
                        version: '9.0.300',
                    },
                })
            )
        ).rejects.toThrow('invalid ready metadata');
        await expect(resolveWorkspaceDotnet(createService({ kind: 'resolving', revision: 1 }), 10)).rejects.toThrow(
            'Timed out'
        );
    });
});

interface TestWorkspaceDotnetService extends WorkspaceDotnetStateServiceV1 {
    disposed: boolean;
    subscribed: boolean;
    emit(state: WorkspaceDotnetStateV1): void;
}

function createService(initialState: WorkspaceDotnetStateV1): TestWorkspaceDotnetService {
    let listener: ((state: WorkspaceDotnetStateV1) => unknown) | undefined;
    const service: TestWorkspaceDotnetService = {
        version: '1.0',
        disposed: false,
        subscribed: false,
        getState: jest.fn(() => initialState),
        onDidChangeState: ((newListener: (state: WorkspaceDotnetStateV1) => unknown) => {
            service.subscribed = true;
            listener = newListener;
            return {
                dispose: () => {
                    service.disposed = true;
                    listener = undefined;
                },
            };
        }) as vscode.Event<WorkspaceDotnetStateV1>,
        emit: (state) => listener?.(state),
    };
    return service;
}

function setOrDeleteEnvironmentVariable(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}
