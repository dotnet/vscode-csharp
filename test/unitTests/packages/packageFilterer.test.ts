/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as chai from 'chai';
import { PlatformInformation } from "../../../src/shared/platform";
import { getNotInstalledPackagesForPlatform } from "../../../src/packageManager/packageFilterer";
import { Package } from '../../../src/packageManager/package';
import { AbsolutePathPackage } from '../../../src/packageManager/absolutePathPackage';
import { join } from 'path';

const expect = chai.expect;
// There are no typings for this library.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require("mock-fs");

suite(`${getNotInstalledPackagesForPlatform.name}`, () => {
    let absolutePathPackages: AbsolutePathPackage[];
    const extensionPath = "/ExtensionPath";
    const packages = <Package[]>[
        {
            "description": "linux-Architecture1 uninstalled package",
            "platforms": ["linux"],
            "architectures": ["architecture1"],
            "installPath": "path1"
        },
        {
            //already installed package
            "description": "linux-Architecture1 installed package",
            "platforms": ["linux"],
            "architectures": ["architecture1"],
            "installPath": "path5"
        },
        {
            "description": "win32-Architecture2 uninstalled package",
            "platforms": ["win32"],
            "architectures": ["architecture2"],
            "installPath": "path2"
        },
        {
            "description": "linux-Architecture2 uninstalled package",
            "platforms": ["linux"],
            "architectures": ["architecture2"],
            "installPath": "path3"
        },
        {
            "description": "win32-Architecture1 uninstalled package",
            "platforms": ["win32"],
            "architectures": ["architecture1"],
            "installPath": "path4"
        },
        {
            "description": "linux-Architecture2 uninstalled package",
            "platforms": ["linux"],
            "architectures": ["architecture2"],
            "installPath": "path3"
        },
    ];

    setup(async () => {
        absolutePathPackages = packages.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
        const installLockPath = join(absolutePathPackages[1].installPath.value, "install.Lock");
        //mock the install lock path so the package should be filtered
        mock({
            [installLockPath]: "no content"
        });
    });

    test('Filters the packages based on Platform Information', async () => {
        const platformInfo = new PlatformInformation("win32", "architecture2");
        const filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("win32-Architecture2 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("win32");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture2");
    });

    test('Returns only the packages where install.Lock is not present', async () => {
        const platformInfo = new PlatformInformation("linux", "architecture1");
        const filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("linux-Architecture1 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("linux");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture1");
    });

    teardown(() => {
        mock.restore();
    });
});
