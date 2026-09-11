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
import {
    completeDebuggerInstall,
    DebugAdapterExecutableFactory,
    resolveWorkspaceDotnetHost,
} from '../../../../src/coreclrDebug/activate';
import { CoreClrDebugUtil } from '../../../../src/coreclrDebug/util';
import { EventStream } from '../../../../src/eventStream';
import { omnisharpOptions } from '../../../../src/shared/options';
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

describe('completeDebuggerInstall', () => {
    test('checks and completes installation with the ready workspace host', async () => {
        const debugUtil = new CoreClrDebugUtil('C:\\extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const environment = { DOTNET_ROOT: 'C:\\selected', DOTNET_ROOT_X64: null };
        getCSharpDevKitMock.mockReturnValue(
            extensionWithHost(async () => ({
                status: 'ready',
                dotnetPath: 'C:\\selected\\dotnet.exe',
                environment,
            })) as unknown as vscode.Extension<CSharpDevKitExports>
        );

        try {
            await expect(
                completeDebuggerInstall(debugUtil, new PlatformInformation('win32', 'x64'), new EventStream())
            ).resolves.toBe(true);
            expect(checkDotNetCli).toHaveBeenCalledWith([], {
                dotnetExecutablePath: 'C:\\selected\\dotnet.exe',
                environment,
            });
            expect(writeEmptyFile).toHaveBeenCalledWith(debugUtil.installCompleteFilePath());
        } finally {
            checkDotNetCli.mockRestore();
            writeEmptyFile.mockRestore();
            getCSharpDevKitMock.mockReset();
        }
    });

    test('does not probe or complete installation when the workspace host is blocked', async () => {
        const debugUtil = new CoreClrDebugUtil('C:\\extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        getCSharpDevKitMock.mockReturnValue(
            extensionWithHost(async () => ({ status: 'blocked' })) as unknown as vscode.Extension<CSharpDevKitExports>
        );

        try {
            await expect(
                completeDebuggerInstall(debugUtil, new PlatformInformation('win32', 'x64'), new EventStream())
            ).resolves.toBe(false);
            expect(checkDotNetCli).not.toHaveBeenCalled();
            expect(writeEmptyFile).not.toHaveBeenCalled();
        } finally {
            checkDotNetCli.mockRestore();
            writeEmptyFile.mockRestore();
            getCSharpDevKitMock.mockReset();
        }
    });

    test('uses standalone probing when the workspace host is not applicable', async () => {
        const debugUtil = new CoreClrDebugUtil('C:\\extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const dotNetCliPaths = jest.spyOn(omnisharpOptions, 'dotNetCliPaths', 'get').mockReturnValue(['C:\\dotnet']);
        getCSharpDevKitMock.mockReturnValue(
            extensionWithHost(async () => ({
                status: 'not-applicable',
            })) as unknown as vscode.Extension<CSharpDevKitExports>
        );

        try {
            await expect(
                completeDebuggerInstall(debugUtil, new PlatformInformation('win32', 'x64'), new EventStream())
            ).resolves.toBe(true);
            expect(checkDotNetCli).toHaveBeenCalledWith(['C:\\dotnet']);
            expect(writeEmptyFile).toHaveBeenCalledWith(debugUtil.installCompleteFilePath());
        } finally {
            checkDotNetCli.mockRestore();
            writeEmptyFile.mockRestore();
            dotNetCliPaths.mockRestore();
            getCSharpDevKitMock.mockReset();
        }
    });
});

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

    test('removes all case-insensitive ambient aliases explicitly cleared by the selected workspace host', async () => {
        const ambientDotnetRoot = process.env.DOTNET_ROOT;
        const ambientDotnetRootX86 = process.env['DOTNET_ROOT(X86)'];
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('C:\\extension');

        try {
            process.env.DOTNET_ROOT = 'C:\\ambient';
            process.env['DOTNET_ROOT(X86)'] = 'C:\\ambient-x86';
            getCSharpDevKitMock.mockReturnValue(
                extensionWithHost(async () => ({
                    status: 'ready',
                    dotnetPath: 'C:\\selected\\dotnet.exe',
                    environment: {
                        DOTNET_ROOT: null,
                        'DOTNET_ROOT(x86)': null,
                        DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
                    },
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

            const mergedEnvironment = { ...process.env, ...executable.options?.env };
            const dotnetRootEntries = Object.entries(mergedEnvironment).filter(
                ([key]) => key.toUpperCase() === 'DOTNET_ROOT'
            );
            const dotnetRootX86Entries = Object.entries(mergedEnvironment).filter(
                ([key]) => key.toUpperCase() === 'DOTNET_ROOT(X86)'
            );
            expect(dotnetRootEntries.length).toBeGreaterThan(0);
            expect(dotnetRootEntries.every(([, value]) => value === undefined)).toBe(true);
            expect(dotnetRootX86Entries.length).toBeGreaterThan(0);
            expect(dotnetRootX86Entries.every(([, value]) => value === undefined)).toBe(true);
            expect(mergedEnvironment.DOTNET_HOST_PATH).toBe('C:\\selected\\dotnet.exe');
        } finally {
            if (ambientDotnetRoot === undefined) {
                delete process.env.DOTNET_ROOT;
            } else {
                process.env.DOTNET_ROOT = ambientDotnetRoot;
            }
            if (ambientDotnetRootX86 === undefined) {
                delete process.env['DOTNET_ROOT(X86)'];
            } else {
                process.env['DOTNET_ROOT(X86)'] = ambientDotnetRootX86;
            }
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
        }
    });

    test('overrides every case-insensitive ambient alias with the selected workspace host value', async () => {
        const ambientDotnetRootX86 = process.env['DOTNET_ROOT(X86)'];
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('C:\\extension');

        try {
            process.env['DOTNET_ROOT(X86)'] = 'C:\\ambient-x86';
            getCSharpDevKitMock.mockReturnValue(
                extensionWithHost(async () => ({
                    status: 'ready',
                    dotnetPath: 'C:\\selected\\dotnet.exe',
                    environment: {
                        'DOTNET_ROOT(x86)': 'C:\\selected-x86',
                    },
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

            const matchingValues = Object.entries({ ...process.env, ...executable.options?.env })
                .filter(([key]) => key.toUpperCase() === 'DOTNET_ROOT(X86)')
                .map(([, value]) => value);
            expect(matchingValues.length).toBeGreaterThan(0);
            expect(matchingValues.every((value) => value === 'C:\\selected-x86')).toBe(true);
        } finally {
            if (ambientDotnetRootX86 === undefined) {
                delete process.env['DOTNET_ROOT(X86)'];
            } else {
                process.env['DOTNET_ROOT(X86)'] = ambientDotnetRootX86;
            }
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
        }
    });
});
