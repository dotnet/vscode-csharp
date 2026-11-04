/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as common from '../../../../src/common';
import {
    CSharpDevKitExports,
    WorkspaceDotnetState,
    WorkspaceDotnetStateService,
} from '../../../../src/csharpDevKitExports';
import {
    completeDebuggerInstall,
    DebugAdapterExecutableFactory,
    resolveWorkspaceDotnetState,
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

function readyState(
    executablePath = '/managed/dotnet',
    environment: Readonly<Record<string, string | null>> = { DOTNET_ROOT: '/managed', PATH: '/managed' },
    revision = 1
): WorkspaceDotnetState {
    return {
        kind: 'ready',
        revision,
        host: {
            executablePath,
            architecture: 'x64',
            environment,
        },
        sdk: {
            path: `${executablePath}/sdk/10.0.100`,
            version: '10.0.100',
        },
    };
}

function extensionWithState(initialState: WorkspaceDotnetState) {
    let state = initialState;
    const emitter = new vscode.EventEmitter<WorkspaceDotnetState>();
    const workspaceDotnet: WorkspaceDotnetStateService = {
        version: '1.0',
        getState: () => state,
        onDidChangeState: emitter.event,
    };

    return {
        extension: {
            activate: async () => ({ workspaceDotnet }),
        },
        publish(next: WorkspaceDotnetState) {
            state = next;
            emitter.fire(next);
        },
        dispose: () => emitter.dispose(),
    };
}

describe('completeDebuggerInstall', () => {
    test('checks and completes installation with the ready workspace host', async () => {
        const debugUtil = new CoreClrDebugUtil('C:\\extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const environment = { DOTNET_ROOT: 'C:\\selected', DOTNET_ROOT_X64: null };
        const fixture = extensionWithState(readyState('C:\\selected\\dotnet.exe', environment));
        getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);

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
            fixture.dispose();
        }
    });

    test('does not probe or complete installation when the workspace host is blocked', async () => {
        const debugUtil = new CoreClrDebugUtil('C:\\extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const fixture = extensionWithState({ kind: 'blocked', revision: 1 });
        getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);

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
            fixture.dispose();
        }
    });

    test('uses standalone probing when the workspace host is not applicable', async () => {
        const debugUtil = new CoreClrDebugUtil('C:\\extension');
        const checkDotNetCli = jest.spyOn(debugUtil, 'checkDotNetCli').mockResolvedValue();
        const writeEmptyFile = jest.spyOn(CoreClrDebugUtil, 'writeEmptyFile').mockResolvedValue();
        const dotNetCliPaths = jest.spyOn(omnisharpOptions, 'dotNetCliPaths', 'get').mockReturnValue(['C:\\dotnet']);
        const fixture = extensionWithState({ kind: 'notApplicable', revision: 1 });
        getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);

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
            fixture.dispose();
        }
    });
});

describe('resolveWorkspaceDotnetState', () => {
    test('uses standalone behavior when C# Dev Kit is absent', async () => {
        await expect(resolveWorkspaceDotnetState(null)).resolves.toBeUndefined();
    });

    test('uses standalone behavior with old C# Dev Kit exports', async () => {
        await expect(resolveWorkspaceDotnetState({ activate: async () => ({}) })).resolves.toBeUndefined();
    });

    test('uses standalone behavior with the original 0.1 workspace dotnet service', async () => {
        const emitter = new vscode.EventEmitter();
        try {
            await expect(
                resolveWorkspaceDotnetState({
                    activate: async () =>
                        ({
                            dotnet: {
                                version: '0.1',
                                getSdkInfo: () => undefined,
                                onDidChangeSdkInfo: emitter.event,
                            },
                        }) as unknown as Pick<CSharpDevKitExports, 'workspaceDotnet'>,
                })
            ).resolves.toBeUndefined();
        } finally {
            emitter.dispose();
        }
    });

    test('suppresses standalone probing when Workspace Requirements is blocked', async () => {
        const fixture = extensionWithState({ kind: 'blocked', revision: 1 });
        try {
            await expect(resolveWorkspaceDotnetState(fixture.extension)).resolves.toEqual({
                kind: 'blocked',
                revision: 1,
            });
        } finally {
            fixture.dispose();
        }
    });

    test('returns the exact selected managed host and environment', async () => {
        const environment = { DOTNET_ROOT: '/managed', PATH: '/managed' };
        const state = readyState('/managed/dotnet', environment);
        const fixture = extensionWithState(state);
        try {
            await expect(resolveWorkspaceDotnetState(fixture.extension)).resolves.toBe(state);
        } finally {
            fixture.dispose();
        }
    });

    test('uses standalone behavior when Workspace Requirements is not applicable', async () => {
        const fixture = extensionWithState({ kind: 'notApplicable', revision: 1 });
        try {
            await expect(resolveWorkspaceDotnetState(fixture.extension)).resolves.toEqual({
                kind: 'notApplicable',
                revision: 1,
            });
        } finally {
            fixture.dispose();
        }
    });

    test('falls back when C# Dev Kit activation rejects without an unhandled rejection', async () => {
        await expect(
            resolveWorkspaceDotnetState({
                activate: async () => Promise.reject(new Error('activation failed')),
            })
        ).resolves.toBeUndefined();
    });

    test('falls back when reading the workspace service rejects', async () => {
        await expect(
            resolveWorkspaceDotnetState({
                activate: async () => ({
                    workspaceDotnet: {
                        version: '1.0',
                        getState: () => {
                            throw new Error('selection unavailable');
                        },
                        onDidChangeState: () => ({ dispose: () => {} }),
                    },
                }),
            })
        ).resolves.toBeUndefined();
    });

    test('bounds an activation that never settles and falls back', async () => {
        jest.useFakeTimers();
        try {
            const result = resolveWorkspaceDotnetState({ activate: async () => new Promise(() => {}) }, 100);
            await jest.advanceTimersByTimeAsync(100);
            await expect(result).resolves.toBeUndefined();
        } finally {
            jest.useRealTimers();
        }
    });

    test('does not read workspace state when activation completes after the fallback timeout', async () => {
        jest.useFakeTimers();
        try {
            const getState = jest.fn<() => WorkspaceDotnetState>(() => ({ kind: 'blocked', revision: 1 }));
            const onDidChangeState = jest.fn<WorkspaceDotnetStateService['onDidChangeState']>(() => ({
                dispose: () => {},
            }));
            const activationExports = {
                workspaceDotnet: {
                    version: '1.0' as const,
                    getState,
                    onDidChangeState,
                },
            };
            let completeActivation: (exports: typeof activationExports) => void = () => {};
            const activation = new Promise<typeof activationExports>((resolve) => {
                completeActivation = resolve;
            });

            const result = resolveWorkspaceDotnetState({ activate: async () => activation }, 100);
            await jest.advanceTimersByTimeAsync(100);
            await expect(result).resolves.toBeUndefined();

            completeActivation(activationExports);
            await jest.runAllTimersAsync();
            expect(onDidChangeState).not.toHaveBeenCalled();
            expect(getState).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    test('subscribes before reading and waits for resolving state to become ready', async () => {
        const fixture = extensionWithState({ kind: 'resolving', revision: 0 });
        const state = readyState('/managed/dotnet', { DOTNET_ROOT: '/managed' }, 1);
        try {
            const result = resolveWorkspaceDotnetState(fixture.extension);
            await Promise.resolve();
            await Promise.resolve();
            fixture.publish(state);
            await expect(result).resolves.toBe(state);
        } finally {
            fixture.dispose();
        }
    });

    test('waits for resolving state to become blocked', async () => {
        const fixture = extensionWithState({ kind: 'resolving', revision: 0 });
        try {
            const result = resolveWorkspaceDotnetState(fixture.extension);
            await Promise.resolve();
            await Promise.resolve();
            fixture.publish({ kind: 'blocked', revision: 1 });
            await expect(result).resolves.toEqual({ kind: 'blocked', revision: 1 });
        } finally {
            fixture.dispose();
        }
    });

    test('does not miss a state change between subscribing and reading', async () => {
        const ready = readyState();
        let listener: ((state: WorkspaceDotnetState) => unknown) | undefined;
        const service: WorkspaceDotnetStateService = {
            version: '1.0',
            onDidChangeState: (next) => {
                listener = next;
                return {
                    dispose: () => {
                        listener = undefined;
                    },
                };
            },
            getState: () => {
                listener?.(ready);
                return { kind: 'resolving', revision: 0 };
            },
        };

        await expect(
            resolveWorkspaceDotnetState({
                activate: async () => ({ workspaceDotnet: service }),
            })
        ).resolves.toBe(ready);
        expect(listener).toBeUndefined();
    });

    test('disposes the state subscription after timeout and ignores late state changes', async () => {
        jest.useFakeTimers();
        const dispose = jest.fn();
        let listener: ((state: WorkspaceDotnetState) => unknown) | undefined;
        let notifySubscribed: () => void = () => {};
        const subscribed = new Promise<void>((resolve) => {
            notifySubscribed = resolve;
        });
        const service: WorkspaceDotnetStateService = {
            version: '1.0',
            getState: () => ({ kind: 'resolving', revision: 0 }),
            onDidChangeState: (next) => {
                listener = next;
                notifySubscribed();
                return {
                    dispose: () => {
                        listener = undefined;
                        dispose();
                    },
                };
            },
        };
        try {
            const result = resolveWorkspaceDotnetState(
                {
                    activate: async () => ({ workspaceDotnet: service }),
                },
                100
            );
            await subscribed;
            await jest.advanceTimersByTimeAsync(100);
            await expect(result).resolves.toBeUndefined();
            expect(dispose).toHaveBeenCalled();

            listener?.(readyState());
            await jest.runAllTimersAsync();
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('DebugAdapterExecutableFactory', () => {
    test('does not probe ambient dotnet when Workspace Requirements is blocked', async () => {
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('C:\\extension');
        const fixture = extensionWithState({ kind: 'blocked', revision: 1 });
        getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);

        try {
            const factory = new DebugAdapterExecutableFactory(
                new CoreClrDebugUtil('C:\\extension'),
                new PlatformInformation('win32', 'x64'),
                new EventStream(),
                {},
                'C:\\extension'
            );

            await expect(
                factory.createDebugAdapterDescriptor({ configuration: {} } as vscode.DebugSession, undefined)
            ).rejects.toThrow('Failed to complete the installation of the C# extension');
            expect(getDotnetInfoMock).not.toHaveBeenCalled();
        } finally {
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
            fixture.dispose();
        }
    });

    test('launches vsdbg-ui with the selected workspace host environment instead of the ambient root', async () => {
        const ambientDotnetRoot = process.env.DOTNET_ROOT;
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('C:\\extension');
        const environment = {
            DOTNET_ROOT: 'C:\\selected',
            DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
            DOTNET_MULTILEVEL_LOOKUP: '0',
            PATH: 'C:\\selected;C:\\Windows',
            DOTNET_ROOT_X64: null,
        };
        const fixture = extensionWithState(readyState('C:\\selected\\dotnet.exe', environment));

        try {
            process.env.DOTNET_ROOT = 'C:\\ambient';
            getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);
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

            expect(executable.options?.env).toMatchObject({
                DOTNET_ROOT: 'C:\\selected',
                DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
                DOTNET_MULTILEVEL_LOOKUP: '0',
                PATH: 'C:\\selected;C:\\Windows',
            });
            const dotnetRootValues = Object.entries(executable.options?.env ?? {})
                .filter(([key]) => key.toUpperCase() === 'DOTNET_ROOT')
                .map(([, value]) => value);
            const dotnetRootX64Values = Object.entries(executable.options?.env ?? {})
                .filter(([key]) => key.toUpperCase() === 'DOTNET_ROOT_X64')
                .map(([, value]) => value);
            expect(dotnetRootValues.length).toBeGreaterThan(0);
            expect(dotnetRootValues.every((value) => value === 'C:\\selected')).toBe(true);
            expect(dotnetRootX64Values.length).toBeGreaterThan(0);
            expect(dotnetRootX64Values.every((value) => value === undefined)).toBe(true);
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
            fixture.dispose();
        }
    });

    test('preserves case-sensitive Unix environment aliases', async () => {
        const ambientPathAlias = process.env.Path;
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('/extension');
        const fixture = extensionWithState(
            readyState('/selected/dotnet', {
                PATH: '/selected:/usr/bin',
            })
        );

        try {
            process.env.Path = 'unrelated-case-sensitive-value';
            getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);
            getDotnetInfoMock.mockResolvedValue({
                CliPath: '/selected/dotnet',
                FullInfo: '',
                Version: '10.0.100',
                RuntimeId: 'linux-x64',
                Architecture: 'x64',
                Runtimes: {},
            });

            const factory = new DebugAdapterExecutableFactory(
                new CoreClrDebugUtil('/extension'),
                new PlatformInformation('linux', 'x64'),
                new EventStream(),
                {},
                '/extension'
            );
            const executable = (await factory.createDebugAdapterDescriptor(
                { configuration: {} } as vscode.DebugSession,
                undefined
            )) as vscode.DebugAdapterExecutable;

            expect(executable.options?.env).toMatchObject({
                PATH: '/selected:/usr/bin',
                DOTNET_ROOT: '/selected',
            });
            expect(executable.options?.env).not.toHaveProperty('Path');
        } finally {
            if (ambientPathAlias === undefined) {
                delete process.env.Path;
            } else {
                process.env.Path = ambientPathAlias;
            }
            existsSync.mockRestore();
            getExtensionPath.mockRestore();
            getCSharpDevKitMock.mockReset();
            getDotnetInfoMock.mockReset();
            fixture.dispose();
        }
    });

    test('removes all case-insensitive ambient aliases explicitly cleared by the selected workspace host', async () => {
        const ambientDotnetRoot = process.env.DOTNET_ROOT;
        const ambientDotnetRootX86 = process.env['DOTNET_ROOT(X86)'];
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('C:\\extension');
        const fixture = extensionWithState(
            readyState('C:\\selected\\dotnet.exe', {
                DOTNET_ROOT: null,
                'DOTNET_ROOT(x86)': null,
                DOTNET_HOST_PATH: 'C:\\selected\\dotnet.exe',
            })
        );

        try {
            process.env.DOTNET_ROOT = 'C:\\ambient';
            process.env['DOTNET_ROOT(X86)'] = 'C:\\ambient-x86';
            getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);
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
            fixture.dispose();
        }
    });

    test('overrides every case-insensitive ambient alias with the selected workspace host value', async () => {
        const ambientDotnetRootX86 = process.env['DOTNET_ROOT(X86)'];
        const existsSync = jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
        const getExtensionPath = jest.spyOn(common, 'getExtensionPath').mockReturnValue('C:\\extension');
        const fixture = extensionWithState(
            readyState('C:\\selected\\dotnet.exe', {
                'DOTNET_ROOT(x86)': 'C:\\selected-x86',
            })
        );

        try {
            process.env['DOTNET_ROOT(X86)'] = 'C:\\ambient-x86';
            getCSharpDevKitMock.mockReturnValue(fixture.extension as unknown as vscode.Extension<CSharpDevKitExports>);
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
            fixture.dispose();
        }
    });
});
