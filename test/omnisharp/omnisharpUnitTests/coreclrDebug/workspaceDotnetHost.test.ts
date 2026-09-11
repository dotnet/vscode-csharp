/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { WorkspaceDotnetHost, WorkspaceDotnetService, WorkspaceSdkInfo } from '../../../../src/csharpDevKitExports';
import { resolveWorkspaceDotnetHost } from '../../../../src/coreclrDebug/activate';

function extensionWithHost(getWorkspaceDotnetHost?: () => Promise<WorkspaceDotnetHost>) {
    const emitter = new vscode.EventEmitter<WorkspaceSdkInfo>();
    const dotnet: WorkspaceDotnetService = {
        version: '0.1',
        getSdkInfo: () => undefined,
        onDidChangeSdkInfo: emitter.event,
        getWorkspaceDotnetHost,
    };

    return {
        activate: async () => ({ dotnet }),
    };
}

describe('resolveWorkspaceDotnetHost', () => {
    test('uses standalone behavior when C# Dev Kit is absent', async () => {
        await expect(resolveWorkspaceDotnetHost(null)).resolves.toBeUndefined();
    });

    test('uses standalone behavior with old C# Dev Kit exports', async () => {
        await expect(resolveWorkspaceDotnetHost({ activate: async () => ({}) })).resolves.toBeUndefined();
    });

    test('uses standalone behavior with the original 0.1 workspace dotnet service', async () => {
        await expect(resolveWorkspaceDotnetHost(extensionWithHost())).resolves.toBeUndefined();
    });

    test('suppresses standalone probing when Workspace Requirements is blocked', async () => {
        await expect(
            resolveWorkspaceDotnetHost(extensionWithHost(async () => ({ status: 'blocked' })))
        ).resolves.toEqual({ status: 'blocked' });
    });

    test('returns the exact selected managed host and environment', async () => {
        const environment = { DOTNET_ROOT: '/managed', PATH: '/managed' };

        await expect(
            resolveWorkspaceDotnetHost(
                extensionWithHost(async () => ({
                    status: 'ready',
                    dotnetPath: '/managed/dotnet',
                    environment,
                }))
            )
        ).resolves.toEqual({ status: 'ready', dotnetPath: '/managed/dotnet', environment });
    });

    test('uses standalone behavior when Workspace Requirements is not applicable', async () => {
        await expect(
            resolveWorkspaceDotnetHost(extensionWithHost(async () => ({ status: 'not-applicable' })))
        ).resolves.toEqual({ status: 'not-applicable' });
    });

    test('falls back when C# Dev Kit activation rejects without an unhandled rejection', async () => {
        await expect(
            resolveWorkspaceDotnetHost({
                activate: async () => Promise.reject(new Error('activation failed')),
            })
        ).resolves.toBeUndefined();
    });

    test('falls back when the optional export rejects', async () => {
        await expect(
            resolveWorkspaceDotnetHost(
                extensionWithHost(async () => Promise.reject(new Error('selection unavailable')))
            )
        ).resolves.toBeUndefined();
    });

    test('bounds an activation that never settles and falls back', async () => {
        jest.useFakeTimers();
        try {
            const result = resolveWorkspaceDotnetHost({ activate: async () => new Promise(() => {}) }, 100);
            await jest.advanceTimersByTimeAsync(100);
            await expect(result).resolves.toBeUndefined();
        } finally {
            jest.useRealTimers();
        }
    });
});
