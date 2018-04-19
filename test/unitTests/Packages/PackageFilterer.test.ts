/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as chai from 'chai';
import * as util from '../../../src/common';
import { createTmpDir } from "../../../src/CreateTmpAsset";
import { PlatformInformation } from "../../../src/platform";
import { filterPackages } from "../../../src/packageManager/PackageFilterer";
import { ResolveFilePaths } from "../../../src/packageManager/PackageFilePathResolver";
import { Package } from "../../../src/packageManager/Package";

let expect = chai.expect;

suite('PackageFilterer', () => {
    const packages = <Package[]>[
        {
            "platforms": [ "platform1" ],
            "architectures": [ "architecture1" ],
            "installTestPath": "path1"
        },
        {
            "platforms": [ "platform2" ],
            "architectures": [ "architecture2" ],
            "installTestPath": "path2"
        },
        {
            "platforms": [ "platform1" ],
            "architectures": [ "architecture2" ],
            "installTestPath": "path3"
        },
        {
            "platforms": [ "platform2" ],
            "architectures": [ "architecture1" ],
            "installTestPath": "path4"
        },
    ];

    setup(async () => {
        let tmpDir = await createTmpDir(false);
        util.setExtensionPath(tmpDir.name);
        packages.forEach(pkg => ResolveFilePaths(pkg));
    });

    test('Filters the packages based on Platform Information', async () => {
        let platformInfo = new PlatformInformation("platform1", "architecture1");
        let filteredPackages = await filterPackages(packages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].platforms[0]).to.be.equal("platform1");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture1");
    });

    test('Returns only uninstalled packages', () => {
        
    });
});