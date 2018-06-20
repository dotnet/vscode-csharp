/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as chai from 'chai';
import * as util from '../../../src/common';
import { CreateTmpFile, TmpAsset } from "../../../src/CreateTmpAsset";
import { PlatformInformation } from "../../../src/platform";
import { getPlatformSpecificNotInstalledPackages } from "../../../src/packageManager/PackageFilterer";
import { IPackage } from '../../../src/packageManager/IPackage';
import { InstallablePackage } from "../../../src/packageManager/InstallablePackage";

let expect = chai.expect;

suite(getPlatformSpecificNotInstalledPackages.name, () => {
    let tmpFile: TmpAsset;
    let extensionPath = "/ExtensionPath";
    const packages = <IPackage[]>[
        {   
            "description": "Platform1-Architecture1 uninstalled package",
            "platforms": [ "platform1" ],
            "architectures": [ "architecture1" ],
            "installTestPath": "path1"
        },
        {   
            //already installed package
            "description": "Platform1-Architecture1 installed package",
            "platforms": [ "platform1" ],
            "architectures": [ "architecture1" ],
        },
        {
            "description": "Platform2-Architecture2 uninstalled package",
            "platforms": [ "platform2" ],
            "architectures": [ "architecture2" ],
        },
        {
            "description": "Platform1-Architecture2 uninstalled package",
            "platforms": [ "platform1" ],
            "architectures": [ "architecture2" ],
        },
        {
            "description": "Platform2-Architecture1 package",
            "platforms": [ "platform2" ],
            "architectures": [ "architecture1" ],
        },
        {
            "description": "Platform1-Architecture2 uninstalled package",
            "platforms": [ "platform1" ],
            "architectures": [ "architecture2" ],
        },
        {
            "description": "Platform3-Architecture3 with no installTestPath specified",
            "platforms": [ "platform3" ],
            "architectures": [ "architecture3" ],
        },
    ];

    let installablePackages: InstallablePackage[];

    setup(async () => {
        tmpFile = await CreateTmpFile();
        util.setExtensionPath(extensionPath);
        packages[1].installTestPath = tmpFile.name;
        // we need to set the extension path because fileresolver uses it
        installablePackages = InstallablePackage.getInstallablePackages(packages);
    });

    test('Filters the packages based on Platform Information', async () => {
        let platformInfo = new PlatformInformation("platform2", "architecture2");
        let filteredPackages = await getPlatformSpecificNotInstalledPackages(installablePackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Platform2-Architecture2 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("platform2");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture2");
    });

    test('Returns only uninstalled packages', async () => {
        let platformInfo = new PlatformInformation("platform1", "architecture1");
        let filteredPackages = await getPlatformSpecificNotInstalledPackages(installablePackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Platform1-Architecture1 uninstalled package");
        expect(filteredPackages[0].platforms[0]).to.be.equal("platform1");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture1");
    });

    test('Doesnot filter the package if install test path is not specified', async () => {
        let platformInfo = new PlatformInformation("platform3", "architecture3");
        let filteredPackages = await getPlatformSpecificNotInstalledPackages(installablePackages, platformInfo);
        expect(filteredPackages.length).to.be.equal(1);
        expect(filteredPackages[0].description).to.be.equal("Platform3-Architecture3 with no installTestPath specified");
        expect(filteredPackages[0].platforms[0]).to.be.equal("platform3");
        expect(filteredPackages[0].architectures[0]).to.be.equal("architecture3");
    });

    teardown(() => {
        if (tmpFile) {
            tmpFile.dispose();
        }    
    });
});