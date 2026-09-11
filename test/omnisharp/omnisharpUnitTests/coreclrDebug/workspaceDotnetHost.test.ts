/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as common from '../../../../src/common';
import {
    CSharpDevKitExports,
    WorkspaceDotnetHost,
    WorkspaceDotnetService,
    WorkspaceSdkInfo,
} from '../../../../src/csharpDevKitExports';
import { DebugAdapterExecutableFactory, resolveWorkspaceDotnetHost } from '../../../../src/coreclrDebug/activate';
import { CoreClrDebugUtil } from '../../../../src/coreclrDebug/util';
import { EventStream } from '../../../../src/eventStream';
import { PlatformInformation } from '../../../../src/shared/platform';
import { getDotnetInfo } from '../../../../src/shared/utils/getDotnetInfo';
import { getCSharpDevKit } from '../../../../src/utils/getCSharpDevKit';

jest.mock('vscode', () => {
    const vscode = jest.requireActual<typeof import('vscode')>('../../../../__mocks__/vscode');
    return {
        ...vscode,
        DebugAdapterExecutable: class {
            constructor(
                public readonly command: string,
                public readonly args: readonly string[],
                public readonly options?: vscode.DebugAdapterExecutableOptions
            ) {}
        },
    };
});
jest.mock('../../../../src/shared/utils/getDotnetInfo', () => ({
    getDotnetInfo: jest.fn(),
}));
jest.mock('../../../../src/utils/getCSharpDevKit', () => ({
    getCSharpDevKit: jest.fn(),
}));

const getDotnetInfoMock = jest.mocked(getDotnetInfo);
const getCSharpDevKitMock = jest.mocked(getCSharpDevKit);

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

    test('does not request the workspace host when activation completes after the fallback timeout', async () => {
        jest.useFakeTimers();
        try {
            const getWorkspaceDotnetHost = jest.fn(async (): Promise<WorkspaceDotnetHost> => ({ status: 'blocked' }));
            const extension = extensionWithHost(getWorkspaceDotnetHost);
            let completeActivation: (exports: Awaited<ReturnType<typeof extension.activate>>) => void = () => {};
            const activation = new Promise<Awaited<ReturnType<typeof extension.activate>>>((resolve) => {
                completeActivation = resolve;
            });

            const result = resolveWorkspaceDotnetHost({ activate: async () => activation }, 100);
            await jest.advanceTimersByTimeAsync(100);
            await expect(result).resolves.toBeUndefined();

            completeActivation(await extension.activate());
            await jest.runAllTimersAsync();
            expect(getWorkspaceDotnetHost).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('DebugAdapterExecutableFactory', () => {
    test('launches vsdbg-ui with the selected workspace host environment instead of the ambient root', async () => {
        const ambientDotnetRoot = process.env.DOTNET_ROOT;
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('C:\\extension');

        try {
            process.env.DOTNET_ROOT = 'C:\\ambient';
            const environment = {
                DOTNET_ROOT: 'C:\\selected',
                DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
                DOTNET_MULTILEVEL_LOOKUP: '0',
                PATH: 'C:\\selected;C:\\Windows',
                DOTNET_ROOT_X64: null,
            };
            getCSharpDevKitMock.mockReturnValue(
                extensionWithHost(async () => ({
                    status: 'ready',
                    dotnetPath: 'C:\\selected\\dotnet.exe',
                    environment,
                })) as unknown as vscode.Extension<CSharpDevKitExports>
            );
            getDotnetInfoMock.mockResolvedValue({
                CliPath: 'C:\\selected\\dotnet.exe',
                FullInfo: '',
                Version: '10.0.100',
                RuntimeId: 'win-x64',
                Architecture: 'x64',
                Runtimes: {},
            });

            const factory = new DebugAdapterExecutableFactory(
                new CoreClrDebugUtil('C:\\extension'),
                new PlatformInformation('win32', 'x64'),
                new EventStream(),
                {},
                'C:\\extension'
            );
            const executable = (await factory.createDebugAdapterDescriptor(
                { configuration: {} } as vscode.DebugSession,
                undefined
            )) as vscode.DebugAdapterExecutable;

            expect(executable.options?.env).toEqual({
                DOTNET_ROOT: 'C:\\selected',
                DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
                DOTNET_MULTILEVEL_LOOKUP: '0',
                PATH: 'C:\\selected;C:\\Windows',
            });
        } finally {
            if (ambientDotnetRoot === undefined) {
                delete process.env.DOTNET_ROOT;
            } else {
                process.env.DOTNET_ROOT = ambientDotnetRoot;
            }
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
        }
    });
});
