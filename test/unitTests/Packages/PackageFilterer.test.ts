/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as chai from 'chai';
import { PlatformInformation } from "../../../src/platform";
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
            "description": "Platfrom1-Architecture1 uninstalled package",
            "platforms": ["platform1"],
            "architectures": ["architecture1"],
            "installPath": "path1"
        },
        {
            //already installed package
            "description": "Platfrom1-Architecture1 installed package",
            "platforms": ["platform1"],
            "architectures": ["architecture1"],
            "installPath": "path5"
        },
        {
            "description": "Platfrom2-Architecture2 uninstalled package",
            "platforms": ["platform2"],
            "architectures": ["architecture2"],
            "installPath": "path2"
        },
        {
            "description": "Platfrom1-Architecture2 uninstalled package",
            "platforms": ["platform1"],
            "architectures": ["architecture2"],
            "installPath": "path3"
        },
        {
            "description": "Platfrom2-Architecture1 uninstalled package",
            "platforms": ["platform2"],
            "architectures": ["architecture1"],
            "installPath": "path4"
        },
        {
            "description": "Platfrom1-Architecture2 uninstalled package",
            "platforms": ["platform1"],
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
        let platformInfo = new PlatformInformation("platform2", "architecture2");
        let filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Platfrom2-Architecture2 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("platform2");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture2");
    });

    test('Returns only the packages where install.Lock is not present', async () => {
        let platformInfo = new PlatformInformation("platform1", "architecture1");
        let filteredPackages = await getNotInstalledPackagesForPlatform(absolutePathPackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Platfrom1-Architecture1 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("platform1");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture1");
    });

    teardown(() => {
        mock.restore();
    });
});