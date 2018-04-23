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
import { Package } from '../../../src/packageManager/Package';
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
    let installationPath: string;
    let eventBus: Array<BaseEvent>;
    let packages: Package[];

    const packageDescription = "Test Package";
    const eventStream = new EventStream();
    eventStream.subscribe(event => eventBus.push(event));

    const windowsPlatformInfo = new PlatformInformation("win32", "x86");
    const linuxPlatformInfo = new PlatformInformation("linux", "x86");
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
        installationPath = tmpInstallDir.name;
        packages = <Package[]>[
            {
                url: downloadUrl,
                description: packageDescription,
                installPath: installationPath,
                platforms: [windowsPlatformInfo.platform],
                architectures: [windowsPlatformInfo.architecture]
            }];
        allFiles = [...Files, ...Binaries];
        testDirPath = tmpSourceDir.name + "/test.zip";
        await createTestZipAsync(testDirPath, allFiles);
        await new Promise(resolve => server.start(resolve)); //start the server
        server.on(getRequestHandler('GET', '/package', 200, {
            "content-type": "application/zip",
            "content-length": (await fs.stat(testDirPath)).size
        },  await fs.readFile(testDirPath)));
    });

    test("Downloads the package and installs at the specified path", async () => {
        await DownloadAndInstallPackages(packages, networkSettingsProvider, windowsPlatformInfo, eventStream);
        for (let elem of allFiles) {
            let filePath = path.join(installationPath, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test("Events are created in the correct order", async () => {
        let eventsSequence = [
            new DownloadStart(packageDescription),
            new DownloadSizeObtained(396),
            new DownloadProgress(100, packageDescription),
            new DownloadSuccess(' Done!'),
            new InstallationStart(packageDescription)
        ];

        await DownloadAndInstallPackages(packages, networkSettingsProvider, windowsPlatformInfo, eventStream);
        expect(eventBus).to.be.deep.equal(eventsSequence);
    });

    test("Installs only the platform specific packages", async () => {
        //since there is no linux package specified no package should be installed
        await DownloadAndInstallPackages(packages, networkSettingsProvider, linuxPlatformInfo, eventStream);
        let files = await fs.readdir(tmpInstallDir.name);
        expect(files.length).to.equal(0);
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