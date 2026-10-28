/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../tasks/packaging/offlinePackagingTasks');
jest.mock('../../tasks/runTask');
jest.mock('util', () => {
    const util = jest.requireActual<typeof import('util')>('util');
    return {
        ...util,
        // Node's default argument source is the real process, not Jest's process shim.
        parseArgs: (options: Parameters<typeof util.parseArgs>[0]) =>
            util.parseArgs({ ...options, args: process.argv.slice(2) }),
    };
});

describe('VSIX packaging arguments', () => {
    const originalArgv = process.argv;

    afterEach(() => {
        process.argv = originalArgv;
        jest.clearAllMocks();
    });

    test.each([
        { args: [], offline: false, prerelease: false },
        { args: ['--offline'], offline: true, prerelease: false },
        { args: ['--offline', '--prerelease'], offline: true, prerelease: true },
    ])('parses $args', async ({ args, offline, prerelease }) => {
        process.argv = [process.execPath, 'vsixReleasePackage.ts', ...args];

        await jest.isolateModulesAsync(async () => {
            const { runTask } = await import('../../tasks/runTask');
            const { vsixReleasePackageTask } = await import('../../tasks/packaging/offlinePackagingTasks');
            await import('../../tasks/packaging/vsixReleasePackage');

            await jest.mocked(runTask).mock.calls[0][0]();

            expect(vsixReleasePackageTask).toHaveBeenCalledWith(expect.objectContaining({ offline, prerelease }));
        });
    });

    test('rejects unknown arguments', async () => {
        process.argv = [process.execPath, 'vsixReleasePackage.ts', '--ofline'];

        await expect(
            jest.isolateModulesAsync(async () => {
                await import('../../tasks/packaging/vsixReleasePackage');
            })
        ).rejects.toThrow("Unknown option '--ofline'");
    });
});
