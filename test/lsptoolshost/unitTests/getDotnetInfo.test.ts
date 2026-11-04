/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as common from '../../../src/common';
import { getDotnetInfo } from '../../../src/shared/utils/getDotnetInfo';

jest.mock('../../../src/common', () => ({
    execChildProcess: jest.fn(),
}));

describe('getDotnetInfo', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    test('uses the workspace executable and environment for both CLI probes', async () => {
        const execChildProcess = jest.mocked(common.execChildProcess);
        execChildProcess
            .mockResolvedValueOnce(' Version: 11.0.100\n RID: win-x64\n Architecture: x64')
            .mockResolvedValueOnce('Microsoft.NETCore.App 11.0.0 [C:\\workspace\\shared]');
        const environment = { WORKSPACE_ONLY: 'value', REMOVE_ME: null };

        const result = await getDotnetInfo([], {
            dotnetExecutablePath: 'C:\\workspace\\dotnet.exe',
            architecture: 'arm64',
            environment,
        });

        const firstEnvironment = execChildProcess.mock.calls[0][2];
        const secondEnvironment = execChildProcess.mock.calls[1][2];
        expect(execChildProcess.mock.calls[0][0]).toBe('"C:\\workspace\\dotnet.exe" --info');
        expect(execChildProcess.mock.calls[1][0]).toBe('"C:\\workspace\\dotnet.exe" --list-runtimes');
        expect(firstEnvironment).toMatchObject({
            WORKSPACE_ONLY: 'value',
            DOTNET_CLI_UI_LANGUAGE: 'en-US',
        });
        expect(firstEnvironment).not.toHaveProperty('REMOVE_ME');
        expect(secondEnvironment).toMatchObject({ WORKSPACE_ONLY: 'value' });
        expect(secondEnvironment).not.toHaveProperty('DOTNET_CLI_UI_LANGUAGE');
        expect(secondEnvironment).not.toHaveProperty('REMOVE_ME');
        expect(result).toMatchObject({
            CliPath: 'C:\\workspace\\dotnet.exe',
            Architecture: 'arm64',
        });
        expect(environment).toEqual({ WORKSPACE_ONLY: 'value', REMOVE_ME: null });
    });
});
