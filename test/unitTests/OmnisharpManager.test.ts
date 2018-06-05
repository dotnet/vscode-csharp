/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmnisharpManager } from "../../src/omnisharp/OmnisharpManager";
import MockHttpsServer from "./testAssets/MockHttpsServer";
import TestZip from "./testAssets/TestZip";
import { createTestFile } from "./testAssets/TestFile";
import { PlatformInformation } from "../../src/platform";
import { OmnisharpDownloader } from "../../src/omnisharp/OmnisharpDownloader";
import NetworkSettings from "../../src/NetworkSettings";
import { EventStream } from "../../src/EventStream";
import { testPackageJSON } from "./testAssets/testAssets";
import { TmpAsset, CreateTmpDir, CreateTmpFile } from "../../src/CreateTmpAsset";
import { expect } from 'chai';
import * as path from 'path';
import * as util from '../../src/common';
import { OmniSharpDownloadSettings } from "../../src/omnisharp/OmniSharpDownloadSettings";

suite(OmnisharpManager.name, () => {
    let server: MockHttpsServer;
    const eventStream = new EventStream();
    let manager : OmnisharpManager;
    const testVersion = "1.2.3";
    const latestVersion = "2.3.4";
    const latestfilePath = "latestPath";
    const installPath = "somePath";
    let tmpInstallDir: TmpAsset;
    let tmpInstallPath: string;
    let tmpFile: TmpAsset;
    let testZip: TestZip;
    const packageJSON = {
        defaults:{
            omniSharp : "0.1.2"
        }
    };

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
        suite(elem.platformInfo.toString(), () => {
            setup(async () => {
                server = await MockHttpsServer.CreateMockHttpsServer();
                await server.start();
                tmpInstallDir = await CreateTmpDir(true);
                tmpInstallPath = tmpInstallDir.name;
                util.setExtensionPath(tmpInstallPath);
                manager = GetTestOmniSharpManager(elem.platformInfo, eventStream);
                testZip = await TestZip.createTestZipAsync(createTestFile("Foo", "foo.txt"));
                server.addRequestHandler('GET', `/releases/${testVersion}/omnisharp-${elem.platformId}.zip`, 200, {
                    "content-type": "application/zip",
                    "content-length": testZip.size
                }, testZip.buffer);

                server.addRequestHandler('GET', `/${latestfilePath}`, 200, {
                    "content-type": "application/text",
                }, latestVersion);

                server.addRequestHandler('GET', `/releases/${latestVersion}/omnisharp-${elem.platformId}.zip`, 200, {
                    "content-type": "application/zip",
                    "content-length": testZip.size
                }, testZip.buffer);
            });

            test('Throws error if the path is neither an absolute path nor a valid semver, nor the string "latest"', async () => {
                expect(manager.GetOmniSharpLaunchInfo(new OmniSharpDownloadSettings(() => "some incorrect path", server.baseUrl, latestfilePath, installPath, tmpInstallPath, packageJSON))).to.be.rejectedWith(Error);
            });

            test('Throws error when the specified path is an invalid semver', async () => {
                expect(manager.GetOmniSharpLaunchInfo(new OmniSharpDownloadSettings(() => "a.b.c", server.baseUrl, latestfilePath, installPath, tmpInstallPath, packageJSON))).to.be.rejectedWith(Error);
            });

            test('Returns the same path if absolute path to an existing file is passed', async () => {
                tmpFile = await CreateTmpFile();
                let launchInfo = await manager.GetOmniSharpLaunchInfo(new OmniSharpDownloadSettings(() => tmpFile.name, server.baseUrl, latestfilePath, installPath, tmpInstallPath, packageJSON));
                expect(launchInfo.LaunchPath).to.be.equal(tmpFile.name);
            });

            test('Returns the default path if the omnisharp path is not set', async () => {
                let settings = new OmniSharpDownloadSettings(() => "", server.baseUrl, latestfilePath, installPath, tmpInstallPath, packageJSON);
                let launchInfo = await manager.GetOmniSharpLaunchInfo(settings);
                expect(launchInfo.LaunchPath).to.be.equal(path.join(tmpInstallPath, ".omnisharp", settings.defaultOmniSharpVersion, elem.executable));
                if (elem.platformInfo.isWindows()) {
                    expect(launchInfo.MonoLaunchPath).to.be.undefined;
                }
                else {
                    expect(launchInfo.MonoLaunchPath).to.be.equal(path.join(tmpInstallPath, ".omnisharp", settings.defaultOmniSharpVersion, "omnisharp", "OmniSharp.exe"));
                }
            });

            test('Installs the latest version and returns the launch path ', async () => {
                let launchInfo = await manager.GetOmniSharpLaunchInfo(new OmniSharpDownloadSettings(() => "latest", server.baseUrl, latestfilePath, installPath, tmpInstallPath, packageJSON));
                expect(launchInfo.LaunchPath).to.be.equal(path.join(tmpInstallPath, installPath, latestVersion, elem.executable));
                if (elem.platformInfo.isWindows()) {
                    expect(launchInfo.MonoLaunchPath).to.be.undefined;
                }
                else {
                    expect(launchInfo.MonoLaunchPath).to.be.equal(path.join(tmpInstallPath, installPath, latestVersion, "omnisharp", "OmniSharp.exe"));
                }
            });

            test('Installs the test version and returns the launch path', async () => {
                let launchInfo = await manager.GetOmniSharpLaunchInfo(new OmniSharpDownloadSettings(() => testVersion, server.baseUrl, latestfilePath, installPath, tmpInstallPath, packageJSON));
                expect(launchInfo.LaunchPath).to.be.equal(path.join(tmpInstallPath, installPath, testVersion, elem.executable));
                if (elem.platformInfo.isWindows()) {
                    expect(launchInfo.MonoLaunchPath).to.be.undefined;
                }
                else {
                    expect(launchInfo.MonoLaunchPath).to.be.equal(path.join(tmpInstallPath, installPath, testVersion, "omnisharp", "OmniSharp.exe"));
                }
            });

            test('Downloads package from given url and installs them at the specified path', async () => {
                await manager.GetOmniSharpLaunchInfo(new OmniSharpDownloadSettings(() => testVersion, server.baseUrl, latestfilePath, installPath, tmpInstallPath, packageJSON));
                for (let elem of testZip.files) {
                    let filePath = path.join(tmpInstallPath, installPath, testVersion, elem.path);
                    expect(await util.fileExists(filePath)).to.be.true;
                }
            });
        });
    });

    teardown(async () => {
        await server.stop();
        if (tmpFile) {
            tmpFile.dispose();
            tmpFile = undefined;
        }
        tmpInstallDir.dispose();
        tmpInstallPath = undefined;
    });
});

function GetTestOmniSharpManager(platformInfo: PlatformInformation, eventStream: EventStream): OmnisharpManager {
    let downloader = new OmnisharpDownloader(() => new NetworkSettings(undefined, false), eventStream, testPackageJSON, platformInfo);
    return new OmnisharpManager(downloader, platformInfo);
}