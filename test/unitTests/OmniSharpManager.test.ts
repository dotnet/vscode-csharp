/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { OmnisharpManager, IGetLatestVersion, IGetOmniSharpLaunchInfo, IGetVersionPackages, IInstallCSharpExtDependencies } from "../../src/omnisharp/OmnisharpManager";
import { TmpAsset, CreateTmpDir, CreateTmpFile } from "../../src/CreateTmpAsset";
import { expect } from 'chai';
import { setExtensionPath } from "../../src/common";
import { InstallablePackage } from "../../src/packageManager/Package";

const chai = require("chai");
chai.use(require("chai-as-promised"));

suite(OmnisharpManager.name, () => {
    let tmpDir: TmpAsset;
    let testBasePath: string;
    let tmpFile: TmpAsset;
    let packagesToInstall: InstallablePackage[];
    let latestVersionCalled: boolean;
    const testVersion = "0.1.2";
    const latestVersion = "1.2.3";
    const testVersionPackages: InstallablePackage[] = <InstallablePackage[]>[
        {
            description: "test version package",
        }
    ];

    const latestVersionPackages: InstallablePackage[] = <InstallablePackage[]>[
        {
            description: "latest version package",
        }
    ];

    const getLatestVersion: IGetLatestVersion = async () => {
        latestVersionCalled = true;
        return Promise.resolve(latestVersion);
    };

    const getPackagesFromVersion: IGetVersionPackages = (version: string) => {
        if (version === latestVersion) {
            return latestVersionPackages;
        }
        else {
            return testVersionPackages;
        }
    };

    const installCSharpExtDependencies : IInstallCSharpExtDependencies= async (packages: InstallablePackage[]) => {
        packagesToInstall = packages;
        return Promise.resolve(true);
    };

    const getOmnisharpLaunchInfo: IGetOmniSharpLaunchInfo = (basePath: string) => {
        testBasePath = basePath;
        return {
            LaunchPath: "launchPath"
        };
    };

    const defaultVersion = "defaultVersion";
    const installPath = "installPath";
    let extensionPath: string;
    let omnisharpManager: OmnisharpManager;

    setup(async () => {
        tmpDir = await CreateTmpDir(true);
        extensionPath = tmpDir.name;
        setExtensionPath(extensionPath);
        packagesToInstall = undefined;
        testBasePath = undefined;
        latestVersionCalled = false;
        omnisharpManager = new OmnisharpManager(installCSharpExtDependencies, getLatestVersion, getPackagesFromVersion, getOmnisharpLaunchInfo);
    });

    test("Basepath includes the default version if the omnisharp path is not set", async () => {
        await omnisharpManager.GetOmniSharpLaunchInfo(defaultVersion, "", installPath, extensionPath);
        expect(testBasePath).to.be.equal(path.join(extensionPath, ".omnisharp", defaultVersion));
    });

    test("If absolute path is passed, the launchInfo contains the same", async () => {
        tmpFile = await CreateTmpFile();
        let launchInfo = await omnisharpManager.GetOmniSharpLaunchInfo(defaultVersion, tmpFile.name, installPath, extensionPath);
        expect(launchInfo.LaunchPath).to.be.equal(tmpFile.name);
        expect(launchInfo.MonoLaunchPath).to.be.undefined;
    });

    test(`If "latest" is passed, the latest version is fetched, then the corresponding packages are fetched, installRuntimeDependencies is called with the fetched packages and the basepath contains the latest version`, async () => {
        await omnisharpManager.GetOmniSharpLaunchInfo(defaultVersion, "latest", installPath, extensionPath);
        expect(latestVersionCalled).to.be.true;
        expect(packagesToInstall).to.be.deep.equal(latestVersionPackages);
        expect(testBasePath).to.be.equal(path.join(extensionPath, installPath, latestVersion));
    });

    test(`If a valid semver version is passed, the latest version is fetched, then the corresponding packages are fetched, installRuntimeDependencies is called with the fetched packages and the launchpath contains the latest version`, async () => {
        await omnisharpManager.GetOmniSharpLaunchInfo(defaultVersion, testVersion, installPath, extensionPath);
        expect(packagesToInstall).to.be.deep.equal(testVersionPackages);
        expect(testBasePath).to.be.equal(path.join(extensionPath, installPath, testVersion));
    });

    test("Throws error if an invalid semver is passed", async () => {
        expect(omnisharpManager.GetOmniSharpLaunchInfo(defaultVersion, "someInvalidSemver", installPath, extensionPath)).to.be.rejected;
    });

    teardown(() => {
        if (tmpDir) {
            tmpDir.dispose();
        }
        if (tmpFile) {
            tmpFile.dispose();
        }
    });

});

