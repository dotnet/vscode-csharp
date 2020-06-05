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

suite(OmnisharpManager.name, () => {
    let server: MockHttpsServer;
    const eventStream = new EventStream();
    let manager: OmnisharpManager;
    const defaultVersion = "0.1.2";
    const testVersion = "1.2.3";
    const latestVersion = "2.3.4";
    const latestfilePath = "latestPath";
    const installPath = "somePath";
    let tmpInstallDir: TmpAsset;
    let extensionPath: string;
    let tmpFile: TmpAsset;
    let testZip: TestZip;

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
                extensionPath = tmpInstallDir.name;
                manager = GetTestOmniSharpManager(elem.platformInfo, eventStream, extensionPath);
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
                expect(manager.GetOmniSharpLaunchInfo(defaultVersion, "Some incorrect path", server.baseUrl, latestfilePath, installPath, extensionPath)).to.be.rejectedWith(Error);
            });

            test('Throws error when the specified path is an invalid semver', async () => {
                expect(manager.GetOmniSharpLaunchInfo(defaultVersion, "a.b.c", server.baseUrl, latestfilePath, installPath, extensionPath)).to.be.rejectedWith(Error);
            });

            test('Returns the same path if absolute path to an existing file is passed', async () => {
                tmpFile = await CreateTmpFile();
                let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, tmpFile.name, server.baseUrl, latestfilePath, installPath, extensionPath);
                expect(launchInfo.LaunchPath).to.be.equal(tmpFile.name);
            });

            test('Returns the default path if the omnisharp path is not set', async () => {
                let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, "", server.baseUrl, latestfilePath, installPath, extensionPath);
                expect(launchInfo.LaunchPath).to.be.equal(path.join(extensionPath, ".omnisharp", defaultVersion, elem.executable));
                if (elem.platformInfo.isWindows()) {
                    expect(launchInfo.MonoLaunchPath).to.be.undefined;
                }
                else {
                    expect(launchInfo.MonoLaunchPath).to.be.equal(path.join(extensionPath, ".omnisharp", defaultVersion, "omnisharp", "OmniSharp.exe"));
                }
            });

            test('Installs the latest version and returns the launch path ', async () => {
                let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, "latest", server.baseUrl, latestfilePath, installPath, extensionPath);
                expect(launchInfo.LaunchPath).to.be.equal(path.join(extensionPath, installPath, latestVersion, elem.executable));
                if (elem.platformInfo.isWindows()) {
                    expect(launchInfo.MonoLaunchPath).to.be.undefined;
                }
                else {
                    expect(launchInfo.MonoLaunchPath).to.be.equal(path.join(extensionPath, installPath, latestVersion, "omnisharp", "OmniSharp.exe"));
                }
            });

            test('Installs the test version and returns the launch path', async () => {
                let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, testVersion, server.baseUrl, latestfilePath, installPath, extensionPath);
                expect(launchInfo.LaunchPath).to.be.equal(path.join(extensionPath, installPath, testVersion, elem.executable));
                if (elem.platformInfo.isWindows()) {
                    expect(launchInfo.MonoLaunchPath).to.be.undefined;
                }
                else {
                    expect(launchInfo.MonoLaunchPath).to.be.equal(path.join(extensionPath, installPath, testVersion, "omnisharp", "OmniSharp.exe"));
                }
            });

            test('Downloads package from given url and installs them at the specified path', async () => {
                await manager.GetOmniSharpLaunchInfo(defaultVersion, testVersion, server.baseUrl, latestfilePath, installPath, extensionPath);
                for (let elem of testZip.files) {
                    let filePath = path.join(extensionPath, installPath, testVersion, elem.path);
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
        extensionPath = undefined;
    });
});

function GetTestOmniSharpManager(platformInfo: PlatformInformation, eventStream: EventStream, extensionPath: string): OmnisharpManager {
    let downloader = new OmnisharpDownloader(() => new NetworkSettings(undefined, false), eventStream, testPackageJSON, platformInfo, extensionPath);
    return new OmnisharpManager(downloader, platformInfo);
}