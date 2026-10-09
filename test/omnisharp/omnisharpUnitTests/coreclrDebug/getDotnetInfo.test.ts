/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { execChildProcess } from '../../../../src/common';
import { getDotnetInfo } from '../../../../src/shared/utils/getDotnetInfo';

jest.mock('../../../../src/common', () => ({
    execChildProcess: jest.fn(),
}));

const execChildProcessMock = jest.mocked(execChildProcess);

describe('getDotnetInfo selected host', () => {
    beforeEach(() => {
        execChildProcessMock.mockReset();
        execChildProcessMock
            .mockResolvedValueOnce('SDK:\n Version: 10.0.100\n RID: linux-x64\n Architecture: x64\n')
            .mockResolvedValueOnce('Microsoft.NETCore.App 10.0.0 [/managed/shared/Microsoft.NETCore.App]\n');
    });

    test('passes the exact managed executable to dotnet --info when PATH has no dotnet', async () => {
        const info = await getDotnetInfo([], {
            dotnetExecutablePath: '/managed/dotnet',
            environment: {
                DOTNET_ROOT: '/managed',
                PATH: null,
            },
        });

        expect(info.CliPath).toBe('/managed/dotnet');
        expect(execChildProcessMock).toHaveBeenNthCalledWith(
            1,
            '"/managed/dotnet" --info',
            process.cwd(),
            expect.objectContaining({ DOTNET_ROOT: '/managed', DOTNET_CLI_UI_LANGUAGE: 'en-US' })
        );
        expect(execChildProcessMock.mock.calls[0][2]).not.toHaveProperty('PATH');
        expect(execChildProcessMock).toHaveBeenNthCalledWith(
            2,
            '"/managed/dotnet" --list-runtimes',
            process.cwd(),
            expect.objectContaining({ DOTNET_ROOT: '/managed' })
        );
    });
});
