/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { prepareVSCodeAndExecuteTests } from '../vscodeLauncher';

jest.mock('child_process');
jest.mock('@vscode/test-electron');

describe('VS Code test launcher', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(downloadAndUnzipVSCode).mockResolvedValue('code');
        jest.mocked(resolveCliArgsFromVSCodeExecutablePath).mockReturnValue(['code']);
        jest.mocked(runTests).mockResolvedValue(0);
        jest.mocked(cp.spawnSync).mockReturnValue({
            pid: 1,
            output: [],
            stdout: '',
            stderr: '',
            status: 0,
            signal: null,
        });
    });

    test.each([
        { flag: undefined, disabled: false },
        { flag: 'false', disabled: false },
        { flag: 'true', disabled: true },
    ])('CODE_DISABLE_CSHARP_DEV_KIT=$flag disables Dev Kit: $disabled', async ({ flag, disabled }) => {
        const env = { CODE_DISABLE_CSHARP_DEV_KIT: flag };

        await expect(prepareVSCodeAndExecuteTests('extension', 'tests', 'workspace', 'user-data', env)).resolves.toBe(
            0
        );

        expect(runTests).toHaveBeenCalledTimes(1);
        const options = jest.mocked(runTests).mock.calls[0][0];
        expect(options.extensionDevelopmentPath).toBe('extension');
        expect(options.extensionTestsPath).toBe('tests');
        expect(options.extensionTestsEnv).toBe(env);
        expect(options.launchArgs).toEqual(
            expect.arrayContaining([
                'workspace',
                '-n',
                '--user-data-dir',
                'user-data',
                '--log',
                'ms-dotnettools.csharp:trace',
            ])
        );
        expect(options.launchArgs?.includes('--disable-extension=ms-dotnettools.csdevkit')).toBe(disabled);
        expect(options.launchArgs).not.toContain('--disable-extensions');
    });
});
