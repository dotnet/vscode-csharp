/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import { CSharpDevKitExports, WorkspaceDotnetHost } from '../../../../src/csharpDevKitExports';
import { resolveWorkspaceDotnetHost } from '../../../../src/coreclrDebug/workspaceDotnetHost';

function exportsWithHost(getWorkspaceDotnetHost?: () => Promise<WorkspaceDotnetHost>): CSharpDevKitExports {
    return { getWorkspaceDotnetHost } as unknown as CSharpDevKitExports;
}

describe('resolveWorkspaceDotnetHost', () => {
    test('uses standalone behavior when C# Dev Kit is absent', async () => {
        await expect(resolveWorkspaceDotnetHost(undefined)).resolves.toEqual({ kind: 'standalone' });
    });

    test('uses standalone behavior with old C# Dev Kit exports', async () => {
        await expect(resolveWorkspaceDotnetHost(Promise.resolve(exportsWithHost()))).resolves.toEqual({
            kind: 'standalone',
        });
    });

    test('suppresses standalone probing when Workspace Requirements is blocked', async () => {
        await expect(
            resolveWorkspaceDotnetHost(Promise.resolve(exportsWithHost(async () => ({ status: 'blocked' }))))
        ).resolves.toEqual({ kind: 'blocked' });
    });

    test('returns the exact selected managed host and environment', async () => {
        const environment = { DOTNET_ROOT: '/managed', PATH: '/managed' };

        await expect(
            resolveWorkspaceDotnetHost(
                Promise.resolve(
                    exportsWithHost(async () => ({
                        status: 'ready',
                        dotnetPath: '/managed/dotnet',
                        environment,
                    }))
                )
            )
        ).resolves.toEqual({ kind: 'ready', dotnetPath: '/managed/dotnet', environment });
    });

    test('uses standalone behavior when Workspace Requirements is not applicable', async () => {
        await expect(
            resolveWorkspaceDotnetHost(Promise.resolve(exportsWithHost(async () => ({ status: 'not-applicable' }))))
        ).resolves.toEqual({ kind: 'standalone' });
    });

    test('falls back when C# Dev Kit activation rejects without an unhandled rejection', async () => {
        await expect(resolveWorkspaceDotnetHost(Promise.reject(new Error('activation failed')))).resolves.toEqual({
            kind: 'standalone',
        });
    });

    test('falls back when the optional export rejects', async () => {
        await expect(
            resolveWorkspaceDotnetHost(
                Promise.resolve(exportsWithHost(async () => Promise.reject(new Error('selection unavailable'))))
            )
        ).resolves.toEqual({ kind: 'standalone' });
    });

    test('bounds an activation that never settles without racing Dev Kit remediation', async () => {
        jest.useFakeTimers();
        try {
            const result = resolveWorkspaceDotnetHost(new Promise<CSharpDevKitExports>(() => {}), 100);
            await jest.advanceTimersByTimeAsync(100);
            await expect(result).resolves.toEqual({ kind: 'blocked' });
        } finally {
            jest.useRealTimers();
        }
    });
});
