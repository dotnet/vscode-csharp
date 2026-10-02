/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { WorkspaceDotnetStateServiceV1, WorkspaceDotnetStateV1 } from '../../../src/csharpDevKitExports';
import {
    resolveWorkspaceDotnet,
    WorkspaceDotnetResolutionError,
} from '../../../src/lsptoolshost/dotnetRuntime/workspaceDotnetResolver';

describe('workspace .NET resolver', () => {
    test('uses standalone resolution when the service is absent or unsupported', async () => {
        await expect(resolveWorkspaceDotnet(undefined)).resolves.toBeUndefined();
        await expect(
            resolveWorkspaceDotnet({ version: '2.0' } as unknown as WorkspaceDotnetStateServiceV1)
        ).resolves.toBeUndefined();
    });

    test('uses exact ready metadata', async () => {
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

        expect(result).toEqual({
            architecture: 'arm64',
            environment: {
                DOTNET_ROOT: null,
                WORKSPACE_DOTNET_TEST_ADDED: 'added',
            },
            sdk: {
                path: '/workspace/sdk/10.0.100',
                version: '10.0.100',
            },
        });
        expect(service.disposed).toBe(true);
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

    test('deduplicates an identical event and snapshot with the same revision', async () => {
        const readyState: WorkspaceDotnetStateV1 = {
            kind: 'ready',
            revision: 3,
            host: {
                executablePath: '/workspace/dotnet',
                architecture: 'x64',
                environment: {},
            },
            sdk: {
                path: '/workspace/sdk/10.0.100',
                version: '10.0.100',
            },
        };
        const service = createService(readyState);
        service.getState = () => {
            service.emit({
                ...readyState,
                host: { ...readyState.host, environment: {} },
                sdk: { ...readyState.sdk },
            });
            return readyState;
        };

        await expect(resolveWorkspaceDotnet(service)).resolves.toMatchObject({
            architecture: 'x64',
            sdk: { version: '10.0.100' },
        });
    });

    test('fails closed for conflicting states with the same revision', async () => {
        const service = createService({ kind: 'resolving', revision: 2 });
        service.getState = () => {
            service.emit({ kind: 'blocked', revision: 2 });
            return { kind: 'resolving', revision: 2 };
        };

        await expect(resolveWorkspaceDotnet(service)).rejects.toThrow('conflicting states for the same revision');
        expect(service.disposed).toBe(true);
    });

    test('fails closed for conflicting stale states with the same revision', async () => {
        const service = createService({
            kind: 'ready',
            revision: 3,
            host: {
                executablePath: '/workspace/dotnet',
                architecture: 'x64',
                environment: {},
            },
            sdk: {
                path: '/workspace/sdk/10.0.100',
                version: '10.0.100',
            },
        });
        service.getState = () => {
            service.emit({ kind: 'resolving', revision: 2 });
            service.emit({ kind: 'blocked', revision: 2 });
            return {
                kind: 'ready',
                revision: 3,
                host: {
                    executablePath: '/workspace/dotnet',
                    architecture: 'x64',
                    environment: {},
                },
                sdk: {
                    path: '/workspace/sdk/10.0.100',
                    version: '10.0.100',
                },
            };
        };

        await expect(resolveWorkspaceDotnet(service)).rejects.toThrow('conflicting states for the same revision');
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

    test.each(['subscribe', 'read', 'dispose'] as const)(
        'normalizes producer errors thrown during %s',
        async (failurePoint) => {
            const service = createService({
                kind: 'ready',
                revision: 1,
                host: {
                    executablePath: '/workspace/dotnet',
                    architecture: 'x64',
                    environment: {},
                },
                sdk: {
                    path: '/workspace/sdk/10.0.100',
                    version: '10.0.100',
                },
            });
            if (failurePoint === 'subscribe') {
                service.onDidChangeState = (() => {
                    throw new Error('subscribe failed');
                }) as vscode.Event<WorkspaceDotnetStateV1>;
            } else if (failurePoint === 'read') {
                service.getState = () => {
                    throw new Error('read failed');
                };
            } else {
                service.disposeWithError = true;
            }

            await expect(resolveWorkspaceDotnet(service)).rejects.toBeInstanceOf(WorkspaceDotnetResolutionError);
        }
    );
});

interface TestWorkspaceDotnetService extends WorkspaceDotnetStateServiceV1 {
    disposed: boolean;
    disposeWithError: boolean;
    subscribed: boolean;
    emit(state: WorkspaceDotnetStateV1): void;
}

function createService(initialState: WorkspaceDotnetStateV1): TestWorkspaceDotnetService {
    let listener: ((state: WorkspaceDotnetStateV1) => unknown) | undefined;
    const service: TestWorkspaceDotnetService = {
        version: '1.0',
        disposed: false,
        disposeWithError: false,
        subscribed: false,
        getState: jest.fn(() => initialState),
        onDidChangeState: ((newListener: (state: WorkspaceDotnetStateV1) => unknown) => {
            service.subscribed = true;
            listener = newListener;
            return {
                dispose: () => {
                    service.disposed = true;
                    listener = undefined;
                    if (service.disposeWithError) {
                        throw new Error('dispose failed');
                    }
                },
            };
        }) as vscode.Event<WorkspaceDotnetStateV1>,
        emit: (state) => listener?.(state),
    };
    return service;
}
