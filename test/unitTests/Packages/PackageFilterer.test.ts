/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as chai from 'chai';
import { PlatformInformation } from "../../../src/shared/platform";
import { getNotInstalledPackagesForPlatform } from "../../../src/packageManager/PackageFilterer";
import { Package } from '../../../src/packageManager/Package';
import { AbsolutePathPackage } from '../../../src/packageManager/AbsolutePathPackage';
import { join } from 'path';

let expect = chai.expect;
const mock = require("mock-fs");

suite(`${getNotInstalledPackagesForPlatform.name}`, () => {
    let absolutePathPackages: AbsolutePathPackage[];
    let extensionPath = "/ExtensionPath";
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
        let installLockPath = join(absolutePathPackages[1].installPath.value, "install.Lock");
        //mock the install lock path so the package should be filtered
        mock({
            [installLockPath]: "no content"
        });
    });

    test('Filters the packages based on Platform Information', async () => {
        let platformInfo = new PlatformInformation("win32", "architecture2");
        let filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("win32-Architecture2 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("win32");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture2");
    });

    test('Returns only the packages where install.Lock is not present', async () => {
        let platformInfo = new PlatformInformation("linux", "architecture1");
        let filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("linux-Architecture1 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("linux");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture1");
    });

    teardown(() => {
        mock.restore();
    });
});
