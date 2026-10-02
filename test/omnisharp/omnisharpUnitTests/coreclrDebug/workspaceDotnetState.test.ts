/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as common from '../../../../src/common';
import {
    CSharpDevKitExports,
    WorkspaceDotnetStateServiceV1,
    WorkspaceDotnetStateV1,
} from '../../../../src/csharpDevKitExports';
import {
    activate,
    completeDebuggerInstall,
    DebugAdapterExecutableFactory,
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
        commands: {
            ...vscode.commands,
            registerCommand: jest.fn(() => ({ dispose: () => {} })),
        },
        debug: {
            registerDebugConfigurationProvider: jest.fn(() => ({ dispose: () => {} })),
            registerDebugAdapterDescriptorFactory: jest.fn(() => ({ dispose: () => {} })),
        },
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

describe('debugger activation with C# Dev Kit', () => {
    test('does not wait for C# Dev Kit exports before completing C# activation', async () => {
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockImplementation((filePath) => {
            return !filePath.endsWith('install.complete');
        });
        const checkDotNetCli = jest.spyOn(CoreClrDebugUtil.prototype, 'checkDotNetCli').mockResolvedValue();
        const devKitExports = new Promise<CSharpDevKitExports | undefined>(() => {});
        const context = {
            extensionPath: '/extension',
            subscriptions: [],
        } as unknown as vscode.ExtensionContext;

        try {
            await expect(
                activate(
                    { packageJSON: {}, extensionPath: '/extension' } as vscode.Extension<unknown>,
                    context,
                    new PlatformInformation('linux', 'x64'),
                    new EventStream(),
                    {} as vscode.OutputChannel,
                    undefined,
                    devKitExports
                )
            ).resolves.toBeUndefined();
            expect(checkDotNetCli).not.toHaveBeenCalled();
        } finally {
            existsSync.mockRestore();
            checkDotNetCli.mockRestore();
        }
    });
});

describe('completeDebuggerInstall workspace .NET state', () => {
    test('validates provider SDK metadata without probing and completes installation', async () => {
        const debugUtil = new CoreClrDebugUtil('/extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const checkDotNetSdkVersion = jest.spyOn(debugUtil, 'checkDotNetSdkVersion');
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const provider = createProvider(readyState());
        getCSharpDevKitMock.mockReturnValue(provider.extension);

        try {
            await expect(
                completeDebuggerInstall(debugUtil, new PlatformInformation('linux', 'x64'), new EventStream())
            ).resolves.toBe(true);
            expect(checkDotNetSdkVersion).toHaveBeenCalledWith('10.0.100');
            expect(checkDotNetCli).not.toHaveBeenCalled();
            expect(getDotnetInfoMock).not.toHaveBeenCalled();
            expect(writeEmptyFile).toHaveBeenCalledWith(debugUtil.installCompleteFilePath());
            expect(provider.disposed()).toBe(false);
        } finally {
            checkDotNetCli.mockRestore();
            checkDotNetSdkVersion.mockRestore();
            writeEmptyFile.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
        }
    });

    test.each([
        ['absent or bypassed', undefined],
        [
            'older exports',
            {
                activate: async () => ({}) as CSharpDevKitExports,
            } as unknown as vscode.Extension<CSharpDevKitExports>,
        ],
        ['unsupported', createProvider(undefined, '2.0').extension],
        ['not applicable', createProvider({ kind: 'notApplicable', revision: 1 }).extension],
    ])('retains standalone prerequisite discovery when the provider is %s', async (_name, extension) => {
        const debugUtil = new CoreClrDebugUtil('/extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const dotNetCliPaths = jest.spyOn(omnisharpOptions, 'dotNetCliPaths', 'get').mockReturnValue(['/dotnet']);
        getCSharpDevKitMock.mockReturnValue(extension);

        try {
            await expect(
                completeDebuggerInstall(debugUtil, new PlatformInformation('linux', 'x64'), new EventStream())
            ).resolves.toBe(true);
            expect(checkDotNetCli).toHaveBeenCalledWith(['/dotnet']);
            expect(writeEmptyFile).toHaveBeenCalled();
        } finally {
            checkDotNetCli.mockRestore();
            writeEmptyFile.mockRestore();
            dotNetCliPaths.mockRestore();
            getCSharpDevKitMock.mockReset();
        }
    });

    test.each([
        [
            'blocked',
            createProvider({
                kind: 'blocked',
                revision: 1,
            }).extension,
        ],
        [
            'activation failure',
            {
                activate: async () => Promise.reject(new Error('activation failed')),
            } as unknown as vscode.Extension<CSharpDevKitExports>,
        ],
        ['contract failure', createInvalidProvider()],
        ['state read failure', createThrowingProvider()],
    ])('fails closed without ambient probing or SDK remediation for %s', async (_name, extension) => {
        const debugUtil = new CoreClrDebugUtil('/extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage');
        showErrorMessage.mockClear();
        getCSharpDevKitMock.mockReturnValue(extension);

        try {
            await expect(
                completeDebuggerInstall(debugUtil, new PlatformInformation('linux', 'x64'), new EventStream())
            ).resolves.toBe(false);
            expect(checkDotNetCli).not.toHaveBeenCalled();
            expect(getDotnetInfoMock).not.toHaveBeenCalled();
            expect(writeEmptyFile).not.toHaveBeenCalled();
            expect(showErrorMessage).not.toHaveBeenCalled();
        } finally {
            checkDotNetCli.mockRestore();
            writeEmptyFile.mockRestore();
            showErrorMessage.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
        }
    });

    test('fails closed immediately without remediation while provider resolution is in progress', async () => {
        const debugUtil = new CoreClrDebugUtil('/extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const showErrorMessage = jest.spyOn(vscode.window, 'showErrorMessage');
        showErrorMessage.mockClear();
        getCSharpDevKitMock.mockReturnValue(createProvider({ kind: 'resolving', revision: 1 }).extension);

        try {
            await expect(
                completeDebuggerInstall(debugUtil, new PlatformInformation('linux', 'x64'), new EventStream())
            ).resolves.toBe(false);
            expect(checkDotNetCli).not.toHaveBeenCalled();
            expect(writeEmptyFile).not.toHaveBeenCalled();
            expect(showErrorMessage).not.toHaveBeenCalled();
        } finally {
            checkDotNetCli.mockRestore();
            writeEmptyFile.mockRestore();
            showErrorMessage.mockRestore();
            getCSharpDevKitMock.mockReset();
        }
    });
});

describe('DebugAdapterExecutableFactory workspace .NET state', () => {
    test('uses provider architecture and exact environment without probing or inferring DOTNET_ROOT', async () => {
        const originalDotnetRoot = process.env.DOTNET_ROOT;
        const originalDotnetRootX64 = process.env.DOTNET_ROOT_X64;
        const originalDotnetRootX86 = process.env['DOTNET_ROOT(X86)'];
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('/extension');
        process.env.DOTNET_ROOT = 'C:\\ambient';
        process.env.DOTNET_ROOT_X64 = 'C:\\ambient-x64';
        process.env['DOTNET_ROOT(X86)'] = 'C:\\ambient-x86';
        getCSharpDevKitMock.mockReturnValue(
            createProvider(
                readyState({
                    DOTNET_ROOT: null,
                    dotnet_root_x64: 'C:\\selected-x64',
                    'dotnet_root(x86)': null,
                    DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
                    SELECTED_ONLY: 'selected',
                })
            ).extension
        );

        try {
            const factory = createFactory(new PlatformInformation('win32', 'arm64'));
            const executable = (await factory.createDebugAdapterDescriptor(
                { configuration: {} } as vscode.DebugSession,
                undefined
            )) as vscode.DebugAdapterExecutable;

            expect(executable.command).toContain(`${pathSeparator()}arm64${pathSeparator()}vsdbg-ui`);
            expect(getDotnetInfoMock).not.toHaveBeenCalled();
            expect(executable.options?.env).toMatchObject({
                DOTNET_ROOT: undefined,
                DOTNET_ROOT_X64: 'C:\\selected-x64',
                dotnet_root_x64: 'C:\\selected-x64',
                'DOTNET_ROOT(X86)': undefined,
                'dotnet_root(x86)': undefined,
                DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
                SELECTED_ONLY: 'selected',
            });
        } finally {
            restoreEnvironment('DOTNET_ROOT', originalDotnetRoot);
            restoreEnvironment('DOTNET_ROOT_X64', originalDotnetRootX64);
            restoreEnvironment('DOTNET_ROOT(X86)', originalDotnetRootX86);
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
        }
    });

    test('does not add DOTNET_ROOT when the provider did not contribute it', async () => {
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('/extension');
        getCSharpDevKitMock.mockReturnValue(
            createProvider(
                readyState({
                    DOTNET_HOST_PATH: '/selected/dotnet',
                })
            ).extension
        );

        try {
            const factory = createFactory(new PlatformInformation('linux', 'x64'));
            const executable = (await factory.createDebugAdapterDescriptor(
                { configuration: {} } as vscode.DebugSession,
                undefined
            )) as vscode.DebugAdapterExecutable;

            expect(executable.options?.env).toEqual({ DOTNET_HOST_PATH: '/selected/dotnet' });
            expect(executable.options?.env).not.toHaveProperty('DOTNET_ROOT');
        } finally {
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
        }
    });

    test('fails closed when the provider blocks debug adapter launch', async () => {
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('/extension');
        getCSharpDevKitMock.mockReturnValue(createProvider({ kind: 'blocked', revision: 1 }).extension);

        try {
            const factory = createFactory(new PlatformInformation('linux', 'x64'));

            await expect(
                factory.createDebugAdapterDescriptor({ configuration: {} } as vscode.DebugSession, undefined)
            ).rejects.toThrow('blocked');
            expect(getDotnetInfoMock).not.toHaveBeenCalled();
        } finally {
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
        }
    });

    test('leaves an explicitly supplied debug adapter executable unchanged', async () => {
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('/extension');
        const factory = createFactory(new PlatformInformation('win32', 'arm64'));
        const supplied = new vscode.DebugAdapterExecutable('/custom/adapter', ['--custom'], {
            env: { CUSTOM: 'value' },
        });

        try {
            await expect(
                factory.createDebugAdapterDescriptor({ configuration: {} } as vscode.DebugSession, supplied)
            ).resolves.toBe(supplied);
            expect(getCSharpDevKitMock).not.toHaveBeenCalled();
            expect(getDotnetInfoMock).not.toHaveBeenCalled();
        } finally {
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
        }
    });
});

function createFactory(platformInfo: PlatformInformation): DebugAdapterExecutableFactory {
    return new DebugAdapterExecutableFactory(
        new CoreClrDebugUtil('/extension'),
        platformInfo,
        new EventStream(),
        {},
        '/extension'
    );
}

function readyState(environment: Readonly<Record<string, string | null>> = {}): WorkspaceDotnetStateV1 {
    return {
        kind: 'ready',
        revision: 1,
        host: {
            executablePath: '/selected/dotnet',
            architecture: 'arm64',
            environment,
        },
        sdk: {
            path: '/selected/sdk/10.0.100',
            version: '10.0.100',
        },
    };
}

function createProvider(
    state: WorkspaceDotnetStateV1 | undefined,
    version: string = '1.0'
): {
    extension: vscode.Extension<CSharpDevKitExports>;
    disposed(): boolean;
} {
    let disposed = false;
    const service = {
        version,
        getState: () => state,
        onDidChangeState: () => ({
            dispose: () => {
                disposed = true;
            },
        }),
    } as unknown as WorkspaceDotnetStateServiceV1;
    return {
        extension: {
            activate: async () => ({ workspaceDotnet: service }) as CSharpDevKitExports,
        } as unknown as vscode.Extension<CSharpDevKitExports>,
        disposed: () => disposed,
    };
}

function createInvalidProvider(): vscode.Extension<CSharpDevKitExports> {
    return {
        activate: async () =>
            ({
                workspaceDotnet: {
                    version: '1.0',
                    getState: () => ({ kind: 'ready', revision: 1 }),
                    onDidChangeState: () => ({ dispose: () => {} }),
                },
            }) as unknown as CSharpDevKitExports,
    } as unknown as vscode.Extension<CSharpDevKitExports>;
}

function createThrowingProvider(): vscode.Extension<CSharpDevKitExports> {
    return {
        activate: async () =>
            ({
                workspaceDotnet: {
                    version: '1.0',
                    getState: () => {
                        throw new Error('state read failed');
                    },
                    onDidChangeState: () => ({ dispose: () => {} }),
                },
            }) as unknown as CSharpDevKitExports,
    } as unknown as vscode.Extension<CSharpDevKitExports>;
}

function restoreEnvironment(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
}

function pathSeparator(): string {
    return process.platform === 'win32' ? '\\' : '/';
}
