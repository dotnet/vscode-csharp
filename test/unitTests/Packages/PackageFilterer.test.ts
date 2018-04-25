/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'async-file';
import { TmpAsset, CreateTmpDir } from "../../../src/CreateTmpAsset";
import { PlatformInformation } from "../../../src/platform";
import { filterPackages } from "../../../src/packageManager/PackageFilterer";
import { PackageJSONPackage } from "../../../src/packageManager/PackageJSONPackage";
import { Package } from '../../../src/packageManager/Package';

let expect = chai.expect;
const platform_1 = "Platform-1";
const platform_2 = "Platform-2";
const platform_3 = "Platform-3";
const architecture_1 = "Architecture-1";
const architecture_2 = "Architecture-2";
const architecture_3 = "Architecture-3";

suite('PackageFilterer', () => {
    let tmpDir: TmpAsset;
    let packages: Package[];
    const packageJSONpackages = <PackageJSONPackage[]>[
        {
            "description": "Package 1",
            "platforms": [platform_1],
            "architectures": [architecture_1],
            "installTestPath": "path1"
        },
        {
            //already installed package
            "description": "Package 2",
            "platforms": [platform_1],
            "architectures": [architecture_1],
            "installTestPath": "path2"
        },
        {
            "description": "Package 3",
            "platforms": [platform_2],
            "architectures": [architecture_2],
            "installTestPath": "path3"
        },
        {
            "description": "Package 4",
            "platforms": [platform_1],
            "architectures": [architecture_2],
            "installTestPath": "path4"
        },
        {
            "description": "Package 5",
            "platforms": [platform_2],
            "architectures": [architecture_1],
            "installTestPath": "path4"
        },
        {
            "description": "Package 6",
            "platforms": [platform_3],
            "architectures": [architecture_3],
        },
    ];

    setup(async () => {
        tmpDir = await CreateTmpDir(true);
        packages = packageJSONpackages.map(pkg => new Package(pkg, tmpDir.name));
    });

    test('Filters the packages based on Platform Information', async () => {
        let platformInfo = new PlatformInformation(platform_2, architecture_2);
        /* Here we should have only package for platform2 and architecture2 and not others that have only platform2 and some other architecture 
        / or architecture2 and some other platform */
        let filteredPackages = await filterPackages(packages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Package 3");
        expect(filteredPackages[0].platforms[0]).to.be.equal(platform_2);
        expect(filteredPackages[0].architectures[0]).to.be.equal(architecture_2);
    });

    test('Returns only uninstalled packages', async () => {
        let platformInfo = new PlatformInformation(platform_1, architecture_1);
        await fs.writeFile(packages[1].installTestPath, "Test file");// put a file at the test path
        //Package 2 should be filtered as the test file is present
        let filteredPackages = await filterPackages(packages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Package 1");
        expect(filteredPackages[0].platforms[0]).to.be.equal(platform_1);
        expect(filteredPackages[0].architectures[0]).to.be.equal(architecture_1);
    });

    test('Doesnot filter the package if install test path is not specified', async () => {
        let platformInfo = new PlatformInformation(platform_3, architecture_3);
        let filteredPackages = await filterPackages(packages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Package 6");
        expect(filteredPackages[0].platforms[0]).to.be.equal(platform_3);
        expect(filteredPackages[0].architectures[0]).to.be.equal(architecture_3);
    });

    teardown(() => {
        if (tmpDir) {
            tmpDir.dispose();
        }
    });
});