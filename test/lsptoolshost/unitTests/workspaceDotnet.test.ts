/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import {
    CSharpDevKitExports,
    WorkspaceDotnetState,
    WorkspaceDotnetStateService,
} from '../../../src/csharpDevKitExports';
import { resolveWorkspaceDotnet } from '../../../src/coreclrDebug/workspaceDotnet';
import { applyEnvironmentOverlay } from '../../../src/shared/utils/getDotnetInfo';

describe('workspace .NET resolution', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('uses an initial ready state', async () => {
        const service = createService(readyState(1));

        const result = await resolveWorkspaceDotnet(createExtension(Promise.resolve(createExports(service))), 1000);

        expect(result).toMatchObject({
            kind: 'ready',
            host: {
                executablePath: 'C:\\workspace\\dotnet.exe',
                architecture: 'x64',
                environment: { WORKSPACE_DOTNET_TEST: 'ready' },
            },
            sdk: { path: 'C:\\workspace\\sdk', version: '11.0.100' },
        });
        expect(service.dispose).toHaveBeenCalledTimes(1);
    });

    test.each([
        [{ kind: 'blocked', revision: 1 } satisfies WorkspaceDotnetState, { kind: 'blocked' }],
        [{ kind: 'notApplicable', revision: 1 } satisfies WorkspaceDotnetState, { kind: 'fallback' }],
    ])('maps initial state $state.kind to $expected.kind', async (state, expected) => {
        const result = await resolveWorkspaceDotnet(
            createExtension(Promise.resolve(createExports(createService(state)))),
            1000
        );

        expect(result).toEqual(expected);
    });

    test('falls back when C# Dev Kit is missing or does not export workspaceDotnet v1', async () => {
        await expect(resolveWorkspaceDotnet(null, 1000)).resolves.toEqual({ kind: 'fallback' });
        await expect(
            resolveWorkspaceDotnet(createExtension(Promise.resolve({} as CSharpDevKitExports)), 1000)
        ).resolves.toEqual({ kind: 'fallback' });
        await expect(
            resolveWorkspaceDotnet(
                createExtension(
                    Promise.resolve({
                        workspaceDotnet: { version: '0.1' },
                    } as unknown as CSharpDevKitExports)
                ),
                1000
            )
        ).resolves.toEqual({ kind: 'fallback' });
    });

    test('falls back when activation rejects or the initial state read fails', async () => {
        await expect(
            resolveWorkspaceDotnet(createExtension(Promise.reject(new Error('activation failed'))), 1000)
        ).resolves.toEqual({ kind: 'fallback' });

        const service = createService({ kind: 'resolving', revision: 1 });
        service.getState.mockImplementation(() => {
            throw new Error('state failed');
        });
        await expect(
            resolveWorkspaceDotnet(createExtension(Promise.resolve(createExports(service))), 1000)
        ).resolves.toEqual({ kind: 'fallback' });
        expect(service.dispose).toHaveBeenCalledTimes(1);
    });

    test.each([
        [readyState(2), 'ready'],
        [{ kind: 'blocked', revision: 2 } satisfies WorkspaceDotnetState, 'blocked'],
    ])('waits for resolving to transition to %s', async (terminalState, expectedKind) => {
        const service = createService({ kind: 'resolving', revision: 1 });
        const resultPromise = resolveWorkspaceDotnet(createExtension(Promise.resolve(createExports(service))), 1000);
        await flushPromises();

        service.fire(terminalState);

        await expect(resultPromise).resolves.toMatchObject({ kind: expectedKind });
        expect(service.dispose).toHaveBeenCalledTimes(1);
    });

    test('subscribes before reading state so a transition cannot be lost', async () => {
        const order: string[] = [];
        const service = createService({ kind: 'blocked', revision: 1 });
        service.onDidChangeState = ((listener: (state: WorkspaceDotnetState) => unknown) => {
            order.push('subscribe');
            listener(readyState(2));
            return { dispose: service.dispose };
        }) as vscode.Event<WorkspaceDotnetState>;
        service.getState.mockImplementation(() => {
            order.push('read');
            return { kind: 'blocked', revision: 1 };
        });

        const result = await resolveWorkspaceDotnet(createExtension(Promise.resolve(createExports(service))), 1000);

        expect(order).toEqual(['subscribe']);
        expect(result.kind).toBe('ready');
        expect(service.dispose).toHaveBeenCalledTimes(1);
    });

    test('reads the current state again for a later operation', async () => {
        let currentState: WorkspaceDotnetState = { kind: 'blocked', revision: 1 };
        const service = createService(currentState);
        service.getState.mockImplementation(() => currentState);
        const extension = createExtension(Promise.resolve(createExports(service)));

        await expect(resolveWorkspaceDotnet(extension, 1000)).resolves.toEqual({ kind: 'blocked' });
        currentState = readyState(2);
        await expect(resolveWorkspaceDotnet(extension, 1000)).resolves.toMatchObject({ kind: 'ready' });

        expect(service.getState).toHaveBeenCalledTimes(2);
        expect(service.dispose).toHaveBeenCalledTimes(2);
    });

    test('times out once, disposes the listener, and ignores late events', async () => {
        jest.useFakeTimers();
        const service = createService({ kind: 'resolving', revision: 1 });
        const resultPromise = resolveWorkspaceDotnet(createExtension(Promise.resolve(createExports(service))), 50);
        await flushPromises();

        jest.advanceTimersByTime(50);
        await expect(resultPromise).resolves.toEqual({ kind: 'fallback' });
        service.fire(readyState(2));

        expect(service.dispose).toHaveBeenCalledTimes(1);
    });

    test('ignores activation that completes after timeout', async () => {
        jest.useFakeTimers();
        let completeActivation!: (exports: CSharpDevKitExports) => void;
        const activation = new Promise<CSharpDevKitExports>((resolve) => (completeActivation = resolve));
        const service = createService(readyState(1));
        const resultPromise = resolveWorkspaceDotnet(createExtension(activation), 50);

        jest.advanceTimersByTime(50);
        await expect(resultPromise).resolves.toEqual({ kind: 'fallback' });
        completeActivation(createExports(service));
        await flushPromises();

        expect(service.getState).not.toHaveBeenCalled();
        expect(service.dispose).not.toHaveBeenCalled();
    });
});

describe('workspace .NET environment overlays', () => {
    test('replaces and removes Windows environment aliases case-insensitively without mutating the parent', () => {
        const inherited = { Path: 'parent-path', DOTNET_ROOT: 'parent-root', Keep: 'value' };

        const result = applyEnvironmentOverlay(inherited, { PATH: 'workspace-path', dotnet_root: null }, 'win32');

        expect(result).toEqual({ PATH: 'workspace-path', Keep: 'value' });
        expect(inherited).toEqual({ Path: 'parent-path', DOTNET_ROOT: 'parent-root', Keep: 'value' });
    });

    test.each(['darwin', 'linux'] as const)('treats environment names case-sensitively on %s', (platform) => {
        const result = applyEnvironmentOverlay(
            { PATH: 'upper', Path: 'mixed', REMOVE: 'value' },
            { Path: 'replacement', remove: null },
            platform
        );

        expect(result).toEqual({ PATH: 'upper', Path: 'replacement', REMOVE: 'value' });
    });
});

function readyState(revision: number): WorkspaceDotnetState {
    return {
        kind: 'ready',
        revision,
        host: {
            executablePath: 'C:\\workspace\\dotnet.exe',
            architecture: 'x64',
            environment: { WORKSPACE_DOTNET_TEST: 'ready' },
        },
        sdk: { path: 'C:\\workspace\\sdk', version: '11.0.100' },
    };
}

function createExtension(activation: Promise<CSharpDevKitExports>): vscode.Extension<CSharpDevKitExports> {
    return {
        activate: jest.fn(async () => activation),
    } as unknown as vscode.Extension<CSharpDevKitExports>;
}

function createExports(service: WorkspaceDotnetStateService): CSharpDevKitExports {
    return { workspaceDotnet: service } as CSharpDevKitExports;
}

function createService(initialState: WorkspaceDotnetState): WorkspaceDotnetStateService & {
    getState: jest.Mock<() => WorkspaceDotnetState>;
    onDidChangeState: vscode.Event<WorkspaceDotnetState>;
    fire: (state: WorkspaceDotnetState) => void;
    dispose: jest.Mock<() => void>;
} {
    let listener: ((state: WorkspaceDotnetState) => unknown) | undefined;
    const dispose = jest.fn(() => {
        listener = undefined;
    });
    const service = {
        version: '1.0' as const,
        getState: jest.fn(() => initialState),
        onDidChangeState: ((newListener: (state: WorkspaceDotnetState) => unknown) => {
            listener = newListener;
            return { dispose };
        }) as vscode.Event<WorkspaceDotnetState>,
        fire: (state: WorkspaceDotnetState) => listener?.(state),
        dispose,
    };
    return service;
}

async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}
