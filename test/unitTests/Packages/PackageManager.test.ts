/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as chai from 'chai';
import * as util from '../../../src/common';
import { CreateTmpDir, TmpAsset } from '../../../src/CreateTmpAsset';
import  TestZip  from '../testAssets/TestZip';
import { DownloadAndInstallPackages } from '../../../src/packageManager/PackageManager';
import NetworkSettings from '../../../src/NetworkSettings';
import { PlatformInformation } from '../../../src/platform';
import { EventStream } from '../../../src/EventStream';
import { DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, InstallationStart } from '../../../src/omnisharp/loggingEvents';
import MockHttpsServer from '../testAssets/MockHttpsServer';
import { createTestFile } from '../testAssets/TestFile';
import TestEventBus from '../testAssets/TestEventBus';
import { Package } from '../../../src/packageManager/Package';

chai.use(require("chai-as-promised"));
const expect = chai.expect;

suite("Package Manager", () => {
    let tmpInstallDir: TmpAsset;
    let server: MockHttpsServer;
    let testZip: TestZip;
    let extensionPath: string;
    let eventStream: EventStream;
    let eventBus: TestEventBus;
    let packages: Package[];

    const packageDescription = "Test Package";

    const windowsPlatformInfo = new PlatformInformation("win32", "x86");
    const linuxPlatformInfo = new PlatformInformation("linux", "x86");
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);

    setup(async () => {
        eventStream = new EventStream();
        server = await MockHttpsServer.CreateMockHttpsServer();
        eventBus = new TestEventBus(eventStream);
        tmpInstallDir = await CreateTmpDir(true);
        extensionPath = tmpInstallDir.name;
        packages = <Package[]>[
            {
                url: `${server.baseUrl}/package`,
                description: packageDescription,
                installPath: "installPath",
                platforms: [windowsPlatformInfo.platform],
                architectures: [windowsPlatformInfo.architecture]
            }];

        testZip = await TestZip.createTestZipAsync(createTestFile("Foo", "foo.txt"));
        await server.start();
        server.addRequestHandler('GET', '/package', 200, {
            "content-type": "application/zip",
            "content-length": testZip.size
        }, testZip.buffer);
    });

    test("Downloads the package and installs at the specified path", async () => {
        await DownloadAndInstallPackages(packages, networkSettingsProvider, windowsPlatformInfo, eventStream, extensionPath);
        for (let elem of testZip.files) {
            let filePath = path.join(extensionPath, "installPath", elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test("Events are created in the correct order", async () => {
        let eventsSequence = [
            new DownloadStart(packageDescription),
            new DownloadSizeObtained(testZip.size),
            new DownloadProgress(100, packageDescription),
            new DownloadSuccess(' Done!'),
            new InstallationStart(packageDescription)
        ];

        await DownloadAndInstallPackages(packages, networkSettingsProvider, windowsPlatformInfo, eventStream, extensionPath);
        expect(eventBus.getEvents()).to.be.deep.equal(eventsSequence);
    });

    test("Installs only the platform specific packages", async () => {
        //since there is no linux package specified no package should be installed
        await DownloadAndInstallPackages(packages, networkSettingsProvider, linuxPlatformInfo, eventStream, extensionPath);
        let files = await fs.readdir(tmpInstallDir.name);
        expect(files.length).to.equal(0);
    });

    teardown(async () => {
        if (tmpInstallDir) {
            tmpInstallDir.dispose();
        }

        await server.stop();
        eventBus.dispose();
    });
});