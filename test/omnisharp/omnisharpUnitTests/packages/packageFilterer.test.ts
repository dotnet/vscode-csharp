/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Package } from '../../../../src/packageManager/package.js';
import type { AbsolutePathPackage as AbsolutePathPackageType } from '../../../../src/packageManager/absolutePathPackage.js';
import { MockedFunction } from 'jest-mock';
import type * as fs from 'fs';
import { join } from 'path';

const mockStat = jest.fn() as unknown as MockedFunction<
    (path: fs.PathLike, callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats | undefined) => void) => void
>;
jest.unstable_mockModule('fs', async () => ({
    ...(await import('node:fs')),
    stat: mockStat,
}));
const { PlatformInformation } = await import('../../../../src/shared/platform.js');
const { getNotInstalledPackagesForPlatform } = await import('../../../../src/packageManager/packageFilterer.js');
const { AbsolutePathPackage } = await import('../../../../src/packageManager/absolutePathPackage.js');

describe(`${getNotInstalledPackagesForPlatform.name}`, () => {
    let absolutePathPackages: AbsolutePathPackageType[];
    const extensionPath = '/ExtensionPath';
    const packages = <Package[]>[
        {
            description: 'linux-Architecture1 uninstalled package',
            platforms: ['linux'],
            architectures: ['architecture1'],
            installPath: 'path1',
        },
        {
            //already installed package
            description: 'linux-Architecture1 installed package',
            platforms: ['linux'],
            architectures: ['architecture1'],
            installPath: 'path5',
        },
        {
            description: 'win32-Architecture2 uninstalled package',
            platforms: ['win32'],
            architectures: ['architecture2'],
            installPath: 'path2',
        },
        {
            description: 'linux-Architecture2 uninstalled package',
            platforms: ['linux'],
            architectures: ['architecture2'],
            installPath: 'path3',
        },
        {
            description: 'win32-Architecture1 uninstalled package',
            platforms: ['win32'],
            architectures: ['architecture1'],
            installPath: 'path4',
        },
        {
            description: 'linux-Architecture2 uninstalled package',
            platforms: ['linux'],
            architectures: ['architecture2'],
            installPath: 'path3',
        },
        {
            description: 'neutral platform and architecture uninstalled package',
            platforms: ['neutral'],
            architectures: ['neutral'],
            installPath: 'path6',
        },
        {
            description: 'neutral platform but specific architecture package',
            platforms: ['neutral'],
            architectures: ['architecture1'],
            installPath: 'path7',
        },
        {
            description: 'specific platform but neutral architecture package',
            platforms: ['linux'],
            architectures: ['neutral'],
            installPath: 'path8',
        },
    ];

    beforeEach(async () => {
        absolutePathPackages = packages.map((pkg) => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
        const installLockPath = join(absolutePathPackages[1].installPath.value, 'install.Lock');
        //mock the install lock path so the package should be filtered
        mockStat.mockImplementation((path, callback) => {
            if (installLockPath === path) {
                callback(null, { isFile: () => true } as unknown as fs.Stats);
            } else {
                callback(null, undefined);
            }
        });
    });

    test('Filters the packages based on Platform Information', async () => {
        const platformInfo = new PlatformInformation('win32', 'architecture2');
        const filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).toEqual(2);
        expect(filteredPackages[0].description).toEqual('win32-Architecture2 uninstalled package');
        expect(filteredPackages[0].platforms[0]).toEqual('win32');
        expect(filteredPackages[0].architectures[0]).toEqual('architecture2');

        expect(filteredPackages[1].description).toEqual('neutral platform and architecture uninstalled package');
        expect(filteredPackages[1].platforms[0]).toEqual('neutral');
        expect(filteredPackages[1].architectures[0]).toEqual('neutral');
    });

    test('Returns only the packages where install.Lock is not present', async () => {
        const platformInfo = new PlatformInformation('linux', 'architecture1');
        const filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        // Should include linux-Architecture1 package + neutral package (both uninstalled)
        expect(filteredPackages.length).toEqual(4);

        const descriptions = filteredPackages.map((pkg) => pkg.description);
        expect(descriptions).toContain('linux-Architecture1 uninstalled package');
        expect(descriptions).toContain('neutral platform and architecture uninstalled package');
        expect(descriptions).toContain('neutral platform but specific architecture package');
        expect(descriptions).toContain('specific platform but neutral architecture package');
    });

    test('Returns only neutral packages when no platform-specific packages match', async () => {
        const platformInfo = new PlatformInformation('darwin', 'arm64'); // Non-existent platform/arch combo
        const filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);

        // Should only include neutral package (uninstalled one)
        expect(filteredPackages.length).toEqual(1);
        expect(filteredPackages[0].description).toEqual('neutral platform and architecture uninstalled package');
        expect(filteredPackages[0].platforms[0]).toEqual('neutral');
        expect(filteredPackages[0].architectures[0]).toEqual('neutral');
    });

    test('Filters out installed neutral packages', async () => {
        const platformInfo = new PlatformInformation('darwin', 'arm64'); // Only neutral packages should match
        const filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);

        // Should only return uninstalled neutral package, not the installed one
        expect(filteredPackages.length).toEqual(1);
        expect(filteredPackages[0].description).toEqual('neutral platform and architecture uninstalled package');
    });
});
