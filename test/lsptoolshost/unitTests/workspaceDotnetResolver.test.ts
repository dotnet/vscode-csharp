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
    test('uses standalone resolution when the service is absent or unsupported', () => {
        expect(resolveWorkspaceDotnet(undefined)).toBeUndefined();
        expect(resolveWorkspaceDotnet({ version: '2.0' } as unknown as WorkspaceDotnetStateServiceV1)).toBeUndefined();
    });

    test('reads exact ready metadata without subscribing', () => {
        const service = createService(readyState());
        service.onDidChangeState = (() => {
            throw new Error('must not subscribe');
        }) as vscode.Event<WorkspaceDotnetStateV1>;

        expect(resolveWorkspaceDotnet(service)).toEqual({
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
    });

    test('falls back only for notApplicable', () => {
        expect(resolveWorkspaceDotnet(createService({ kind: 'notApplicable', revision: 1 }))).toBeUndefined();
    });

    test.each([
        [{ kind: 'resolving', revision: 1 } as WorkspaceDotnetStateV1, 'still resolving'],
        [{ kind: 'blocked', revision: 1 } as WorkspaceDotnetStateV1, 'blocked'],
    ])('fails closed immediately for %s', (state, message) => {
        expect(() => resolveWorkspaceDotnet(createService(state))).toThrow(message);
    });

    test('rereads the current state on every attempt', () => {
        let state: WorkspaceDotnetStateV1 = { kind: 'resolving', revision: 1 };
        const service = createService(state);
        service.getState = () => state;

        expect(() => resolveWorkspaceDotnet(service)).toThrow('still resolving');

        state = readyState(2);
        expect(resolveWorkspaceDotnet(service)?.sdk.version).toBe('10.0.100');
    });

    test('fails closed for invalid ready metadata', () => {
        expect(() =>
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
                        path: '/workspace/sdk/10.0.100',
                        version: '10.0.100',
                    },
                })
            )
        ).toThrow('invalid ready metadata');
    });

    test('normalizes producer state-read errors', () => {
        const service = createService(readyState());
        service.getState = () => {
            throw new Error('read failed');
        };

        expect(() => resolveWorkspaceDotnet(service)).toThrow(WorkspaceDotnetResolutionError);
    });
});

function readyState(revision = 1): WorkspaceDotnetStateV1 {
    return {
        kind: 'ready',
        revision,
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
    };
}

function createService(initialState: WorkspaceDotnetStateV1): WorkspaceDotnetStateServiceV1 {
    return {
        version: '1.0',
        getState: jest.fn(() => initialState),
        onDidChangeState: (() => ({ dispose: () => {} })) as vscode.Event<WorkspaceDotnetStateV1>,
    };
}
