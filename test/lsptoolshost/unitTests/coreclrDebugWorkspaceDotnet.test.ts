/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as common from '../../../src/common';
import { createDebugAdapterEnvironment, DebugAdapterExecutableFactory } from '../../../src/coreclrDebug/activate';
import { CoreClrDebugUtil } from '../../../src/coreclrDebug/util';
import { WorkspaceDotnetResolution } from '../../../src/coreclrDebug/workspaceDotnet';
import { PlatformInformation } from '../../../src/shared/platform';
import * as dotnetInfo from '../../../src/shared/utils/getDotnetInfo';

jest.mock('vscode', () => ({
    DebugAdapterExecutable: class {
        constructor(
            readonly command: string,
            readonly args: readonly string[],
            readonly options: vscode.DebugAdapterExecutableOptions | undefined
        ) {}
    },
    l10n: {
        t: (message: string, ...args: string[]) =>
            args.reduce((result, value, index) => result.replace(`{${index}}`, value), message),
    },
    workspace: {
        getConfiguration: () => ({ get: () => false }),
    },
    commands: {
        executeCommand: jest.fn(),
        registerCommand: jest.fn(),
    },
    debug: {
        registerDebugAdapterDescriptorFactory: jest.fn(),
        registerDebugConfigurationProvider: jest.fn(),
        startDebugging: jest.fn(),
    },
    env: { openExternal: jest.fn() },
    Uri: { parse: (value: string) => value },
}));

jest.mock('../../../src/shared/utils/getDotnetInfo', () => ({
    getDotnetInfo: jest.fn(),
}));

describe('coreclr debugger workspace .NET integration', () => {
    beforeEach(() => {
        common.setExtensionPath('C:\\extension');
        jest.spyOn(CoreClrDebugUtil, 'existsSync').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    test('blocked state suppresses ambient probing when launching', async () => {
        const getDotnetInfo = jest.mocked(dotnetInfo.getDotnetInfo);
        const factory = createFactory(async () => ({ kind: 'blocked' }));

        await expect(factory.createDebugAdapterDescriptor(createSession(), undefined)).rejects.toThrow(
            'The workspace .NET SDK is not currently available.'
        );
        expect(getDotnetInfo).not.toHaveBeenCalled();
    });

    test('ready state propagates the workspace host to probing, architecture selection, and launch', async () => {
        const getDotnetInfo = jest.mocked(dotnetInfo.getDotnetInfo);
        getDotnetInfo.mockResolvedValue({
            CliPath: 'C:\\workspace\\dotnet.exe',
            FullInfo: '',
            Version: '11.0.100',
            RuntimeId: 'win-x64',
            Architecture: 'x64',
            Runtimes: {},
        });
        const workspaceDotnet = readyResolution();
        const factory = createFactory(async () => workspaceDotnet);

        const result = (await factory.createDebugAdapterDescriptor(
            createSession(),
            undefined
        )) as vscode.DebugAdapterExecutable;

        expect(getDotnetInfo).toHaveBeenCalledWith([], {
            dotnetExecutablePath: workspaceDotnet.host.executablePath,
            environment: workspaceDotnet.host.environment,
            architecture: workspaceDotnet.host.architecture,
        });
        expect(result.command).toContain('x86_64');
        expect(result.options?.env).toMatchObject({
            PATH: 'C:\\workspace',
            DOTNET_ROOT: 'C:\\workspace',
        });
    });
});

describe('debug adapter workspace environment', () => {
    test('neutralizes Windows aliases for removals and replacements', () => {
        const removed = createDebugAdapterEnvironment(
            { Path: 'first', PATH: null, DOTNET_ROOT: 'C:\\workspace' },
            'C:\\workspace\\dotnet.exe',
            true
        );
        const replaced = createDebugAdapterEnvironment(
            { Path: null, PATH: 'C:\\workspace', DOTNET_ROOT: 'C:\\workspace' },
            'C:\\workspace\\dotnet.exe',
            true
        );

        expect(removed.Path).toBeUndefined();
        expect(removed.PATH).toBeUndefined();
        expect(replaced.Path).toBe('C:\\workspace');
        expect(replaced.PATH).toBe('C:\\workspace');
    });

    test('preserves Unix case sensitivity', () => {
        const environment = createDebugAdapterEnvironment(
            { Path: '/mixed', PATH: null, DOTNET_ROOT: '/workspace' },
            '/workspace/dotnet',
            false
        );

        expect(environment.Path).toBe('/mixed');
        expect(environment.PATH).toBeUndefined();
    });
});

function createFactory(
    resolveWorkspaceDotnet: () => Promise<WorkspaceDotnetResolution>
): DebugAdapterExecutableFactory {
    return new DebugAdapterExecutableFactory(
        new CoreClrDebugUtil('C:\\extension'),
        new PlatformInformation('win32', 'x86_64'),
        { post: jest.fn() } as never,
        {},
        'C:\\extension',
        resolveWorkspaceDotnet
    );
}

function createSession(): vscode.DebugSession {
    return {
        configuration: {},
    } as vscode.DebugSession;
}

function readyResolution(): Extract<WorkspaceDotnetResolution, { kind: 'ready' }> {
    return {
        kind: 'ready',
        host: {
            executablePath: 'C:\\workspace\\dotnet.exe',
            architecture: 'x64',
            environment: {
                PATH: 'C:\\workspace',
                DOTNET_ROOT: 'C:\\workspace',
            },
        },
        sdk: {
            path: 'C:\\workspace\\sdk',
            version: '11.0.100',
        },
    };
}
