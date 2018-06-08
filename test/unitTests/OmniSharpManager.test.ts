/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmnisharpManager } from "../../src/omnisharp/OmnisharpManager";
import { PlatformInformation } from "../../src/platform";
import { Package } from "../../src/packageManager/Package";
import { TmpAsset, CreateTmpDir } from "../../src/CreateTmpAsset";
import { expect } from 'chai';
import * as path from 'path';

suite(OmnisharpManager.name, () => {
    let manager: OmnisharpManager;
    let tmpDir: TmpAsset;
    const testPackages: Package[] = <Package[]>[
        {
            description: "description",
            url: "someUrl"
        }
    ]
    const latestVersion = "latest";
    const getLatestVersion = () => Promise.resolve(latestVersion);
    const getPackagesFromVersion = (version: string) => testPackages;
    const installRuntimeDependencies = (packages: Package[]) => Promise.resolve(true);
    const defaultVersion = "defaultVersion";
    const installPath = "installPath";
    let extensionPath: string;

    setup(async () => {
        tmpDir = await CreateTmpDir(true);
        extensionPath = tmpDir.name;
    });

    [
        {
            platformInfo: new PlatformInformation("win32", "x86"),
            executable: "OmniSharp.exe",
            platformId: "win-x86"
        },
        {
            platformInfo: new PlatformInformation("win32", "x86_64"),
            executable: "OmniSharp.exe",
            platformId: "win-x64"
        },
        {
            platformInfo: new PlatformInformation("linux", "x86_64"),
            executable: "run",
            platformId: "linux-x64"
        },
        {
            platformInfo: new PlatformInformation("linux", "x86"),
            executable: "run",
            platformId: "linux-x86"
        },
        {
            platformInfo: new PlatformInformation("darwin", "x86"),
            executable: "run",
            platformId: "osx"
        }
    ].forEach((elem) => {
        test('Returns the default path if omnisharp path is not set', async () => {
            let manager = new OmnisharpManager(installRuntimeDependencies, getLatestVersion, getPackagesFromVersion, elem.platformInfo)
            let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, "", installPath, extensionPath);
            if (elem.platformInfo.isWindows()) {
                expect(launchInfo.MonoLaunchPath).to.be.undefined;
            }
            else {
                expect(launchInfo.MonoLaunchPath).to.be.equal(path.join(extensionPath, ".omnisharp", defaultVersion, "omnisharp", "OmniSharp.exe"));
            }
        });
    });
});

