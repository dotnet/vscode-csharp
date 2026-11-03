/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import * as path from 'path';
import * as nbgv from 'nerdbank-gitversioning';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as common from '../../src/common';
import { downloadAndInstallPackages } from '../../src/packageManager/downloadAndInstallPackages';
import { getPackageJSON } from '../../tasks/packageJson';
import {
    platformSpecificPackages,
    vsixReleasePackageWindowsTask,
    vsixReleasePackageLinuxTask,
    vsixReleasePackageDarwinTask,
} from '../../tasks/packaging/offlinePackagingTasks';
import { createPackageAsync, generateVsixManifest } from '../../tasks/packaging/vsceTasks';

jest.mock('nerdbank-gitversioning', () => ({
    getVersion: jest.fn(async () => ({ npmPackageVersion: '1.0.0' })),
    setPackageVersion: jest.fn(async () => {}),
    resetPackageVersionPlaceholder: jest.fn(async () => {}),
}));
jest.mock('../../tasks/packageJson');
jest.mock('../../tasks/packaging/vsceTasks');
jest.mock('../../src/packageManager/downloadAndInstallPackages');

describe('offline VSWebAssemblyBridge packaging', () => {
    const originalPlatform = process.platform;
    const options = {
        prerelease: false,
        outputFolder: path.resolve('test-vsix-output'),
        codeExtensionPath: path.resolve('test-extension'),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Exercise every target without the Windows cross-packaging guard.
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const existsSync = fs.existsSync;
        const readFileSync = fs.readFileSync;
        jest.spyOn(fs, 'existsSync').mockImplementation((file) => {
            if (file.toString().endsWith('.gitignore')) {
                return false;
            }
            return file.toString().endsWith('version.nfo') || existsSync(file);
        });
        jest.spyOn(fs, 'readFileSync').mockImplementation((file, encoding) => {
            return file.toString().endsWith('version.nfo') ? 'test-version' : readFileSync(file, encoding);
        });
        jest.spyOn(common, 'fileExists').mockResolvedValue(false);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const packageJSON = jest
            .requireActual<typeof import('../../tasks/packageJson')>('../../tasks/packageJson')
            .getPackageJSON();
        jest.mocked(getPackageJSON).mockReturnValue({
            ...packageJSON,
            defaults: Object.fromEntries(Object.keys(packageJSON.defaults).map((key) => [key, 'test-version'])),
        });
        jest.mocked(downloadAndInstallPackages).mockImplementation(async (packages) =>
            Object.fromEntries(packages.map((pkg) => [pkg.id, true]))
        );
        jest.mocked(createPackageAsync).mockResolvedValue('test.vsix');
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('includes the bridge payload in the VSIX file allowlist', () => {
        const vsixIgnore = fs.readFileSync(path.resolve(__dirname, '..', '..', '.vscodeignore'), 'utf8');
        expect(vsixIgnore.split(/\r?\n/)).toContain('!.vswebassemblybridge/**');
    });

    test.each([
        { platform: 'win32', packageTask: vsixReleasePackageWindowsTask },
        { platform: 'linux', packageTask: vsixReleasePackageLinuxTask },
        { platform: 'darwin', packageTask: vsixReleasePackageDarwinTask },
    ])('bundles the bridge only for supported $platform targets', async ({ platform, packageTask }) => {
        const targets = platformSpecificPackages.filter((target) =>
            platform === 'linux' ? target.platformInfo.isLinux() : target.platformInfo.platform === platform
        );
        jest.mocked(createPackageAsync).mockImplementation(async (_output, _prerelease, _name, target) => {
            const downloads = jest.mocked(downloadAndInstallPackages).mock.calls;
            const packages = downloads[downloads.length - 1][0];
            const platformInfo = targets.find((entry) => entry.vsceTarget === target)!.platformInfo;
            if (platformInfo.platform === 'linux-musl') {
                expect(packages).toHaveLength(0);
                return 'test.vsix';
            }
            expect(packages).toHaveLength(1);
            expect(packages[0].id).toBe('VSWebAssemblyBridge');
            expect(packages[0].installPath.value).toBe(path.join(options.codeExtensionPath, '.vswebassemblybridge'));
            expect(packages[0].platforms).toContain(platformInfo.platform);
            expect(packages[0].architectures).toContain(platformInfo.architecture);
            return 'test.vsix';
        });

        await packageTask(options);

        expect(createPackageAsync).toHaveBeenCalledTimes(targets.length);
        expect(jest.mocked(createPackageAsync).mock.calls.map((call) => call[3])).toEqual(
            targets.map((target) => target.vsceTarget)
        );
        expect(generateVsixManifest).toHaveBeenCalledTimes(targets.length);
        expect(downloadAndInstallPackages).toHaveBeenCalledTimes(targets.length * 3);
    });

    test('does not create a VSIX when bridge installation fails', async () => {
        jest.mocked(downloadAndInstallPackages).mockImplementation(async (packages) =>
            Object.fromEntries(packages.map((pkg) => [pkg.id, pkg.id !== 'VSWebAssemblyBridge']))
        );

        await expect(vsixReleasePackageWindowsTask(options)).rejects.toThrow(
            'The following packages failed to install: VSWebAssemblyBridge'
        );

        expect(createPackageAsync).not.toHaveBeenCalled();
        expect(generateVsixManifest).not.toHaveBeenCalled();
        expect(nbgv.resetPackageVersionPlaceholder).toHaveBeenCalledTimes(1);
    });
});
