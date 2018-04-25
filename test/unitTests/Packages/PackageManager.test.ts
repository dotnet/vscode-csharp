/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as chai from 'chai';
import * as util from '../../../src/common';
import { CreateTmpDir, TmpAsset } from '../../../src/CreateTmpAsset';
import { Binaries, Files, createTestZipAsync } from '../testAssets/CreateTestZip';
import { PackageJSONPackage } from '../../../src/packageManager/Package';
import { DownloadAndInstallPackages } from '../../../src/packageManager/PackageManager';
import NetworkSettings from '../../../src/NetworkSettings';
import { PlatformInformation } from '../../../src/platform';
import { EventStream } from '../../../src/EventStream';
import { BaseEvent, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, InstallationStart } from '../../../src/omnisharp/loggingEvents';
import { getRequestHandler } from '../testAssets/MockHttpServerRequestHandler';

chai.use(require("chai-as-promised"));
const expect = chai.expect;
const ServerMock = require("mock-http-server");
const getPort = require('get-port');

suite("Package Manager", () => {
    let tmpSourceDir: TmpAsset;
    let tmpInstallDir: TmpAsset;
    let server: any;
    let downloadUrl: string;
    let testDirPath: string;
    let allFiles: Array<{ content: string, path: string }>;
    let eventBus: Array<BaseEvent>;
    let package1: PackageJSONPackage;
    let package2: PackageJSONPackage;
    let packages: PackageJSONPackage[];
    
    const eventStream = new EventStream();
    eventStream.subscribe(event => eventBus.push(event));
    const platformInfo1 = new PlatformInformation("platform1", "architecture1");
    const platformInfo2 = new PlatformInformation("platform2", "architecture2");
    
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);

    suiteSetup(async () => {
        let port = await getPort();
        downloadUrl = `https://localhost:${port}/package`;
        server = new ServerMock(null,
            {
                host: "localhost",
                port: port,
                key: await fs.readFile("test/unitTests/testAssets/private.pem"),
                cert: await fs.readFile("test/unitTests/testAssets/public.pem")
            });
    });

    setup(async () => {
        eventBus = [];
        tmpSourceDir = await CreateTmpDir(true);
        tmpInstallDir = await CreateTmpDir(true);
        package1 = <PackageJSONPackage>
            {
                url: downloadUrl,
                description: "Package 1",
                installPath: path.resolve(tmpInstallDir.name,"Path1"),
                platforms: [platformInfo1.platform],
                architectures: [platformInfo1.architecture]
            };

        package2 = <PackageJSONPackage>
            {
                url: downloadUrl,
                description: "Package 2",
                installPath: path.resolve(tmpInstallDir.name,"Path2"),
                platforms: [platformInfo2.platform],
                architectures: [platformInfo2.architecture]
            };
        
        packages = [package1, package2];
        allFiles = [...Files, ...Binaries];
        testDirPath = tmpSourceDir.name + "/test.zip";
        await createTestZipAsync(testDirPath, allFiles);
        await new Promise(resolve => server.start(resolve)); //start the server
        server.on(getRequestHandler('GET', '/package', 200, {
            "content-type": "application/zip",
            "content-length": (await fs.stat(testDirPath)).size
        }, await fs.readFile(testDirPath)));
    });

    test("Downloads the package and installs at the specified path", async () => {
        await DownloadAndInstallPackages(packages, networkSettingsProvider, platformInfo1, eventStream);
        for (let elem of allFiles) {
            //to do: look into how to make it better
            let filePath = path.join(package1.installPath, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test("Events are created in the correct order", async () => {
        let eventsSequence = [
            new DownloadStart(package1.description),
            new DownloadSizeObtained(396),
            new DownloadProgress(100, package1.description),
            new DownloadSuccess(' Done!'),
            new InstallationStart(package1.description)
        ];

        await DownloadAndInstallPackages(packages, networkSettingsProvider, platformInfo1, eventStream);
        expect(eventBus).to.be.deep.equal(eventsSequence);
    });

    test("Installs only the platform specific packages", async () => {
        await DownloadAndInstallPackages(packages, networkSettingsProvider, platformInfo2, eventStream);
        expect(await fs.exists(package2.installPath)).to.be.true;
        expect(await fs.exists(package1.installPath)).to.be.false;
    });

    teardown(async () => {
        if (tmpSourceDir) {
            tmpSourceDir.dispose();
        }
        if (tmpInstallDir) {
            tmpInstallDir.dispose();
        }

        await new Promise((resolve, reject) => server.stop(resolve));
    });
});