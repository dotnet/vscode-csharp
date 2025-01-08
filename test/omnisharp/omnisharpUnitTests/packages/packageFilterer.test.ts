/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PlatformInformation } from '../../../../src/shared/platform';
import { getNotInstalledPackagesForPlatform } from '../../../../src/packageManager/packageFilterer';
import { Package } from '../../../../src/packageManager/package';
import { AbsolutePathPackage } from '../../../../src/packageManager/absolutePathPackage';
import { MockedFunction } from 'jest-mock';
import * as fs from 'fs';
import { join } from 'path';

// Necessary when spying on module members.
jest.mock('fs', () => ({ __esModule: true, ...(<any>jest.requireActual('fs')) }));

describe(`${getNotInstalledPackagesForPlatform.name}`, () => {
    let absolutePathPackages: AbsolutePathPackage[];
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
    ];

    beforeEach(async () => {
        absolutePathPackages = packages.map((pkg) => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
        const installLockPath = join(absolutePathPackages[1].installPath.value, 'install.Lock');
        //mock the install lock path so the package should be filtered
        const statSpy = jest.spyOn(fs, 'stat') as unknown as MockedFunction<
            (
                path: fs.PathLike,
                callback: (err: NodeJS.ErrnoException | null, stats: fs.Stats | undefined) => void
            ) => void
        >;
        statSpy.mockImplementation((path, callback) => {
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
        expect(filteredPackages.length).toEqual(1);
        expect(filteredPackages[0].description).toEqual('win32-Architecture2 uninstalled package');
        expect(filteredPackages[0].platforms[0]).toEqual('win32');
        expect(filteredPackages[0].architectures[0]).toEqual('architecture2');
    });

    test('Returns only the packages where install.Lock is not present', async () => {
        const platformInfo = new PlatformInformation('linux', 'architecture1');
        const filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).toEqual(1);
        expect(filteredPackages[0].description).toEqual('linux-Architecture1 uninstalled package');
        expect(filteredPackages[0].platforms[0]).toEqual('linux');
        expect(filteredPackages[0].architectures[0]).toEqual('architecture1');
    });
});
