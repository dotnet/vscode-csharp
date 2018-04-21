/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as https from 'https';
import * as fs from 'fs';
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
import { BaseEvent, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, InstallationProgress } from '../../../src/omnisharp/loggingEvents';
const getPort = require('get-port');

chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite("Package Manager", () => {
    let tmpSourceDir: TmpAsset;
    let tmpInstallDir: TmpAsset;
    let server: https.Server;
    let testDirPath: string;
    let allFiles: Array<{ content: string, path: string }>;
    let installationPath: string;
    let eventBus: Array<BaseEvent>;
    let packages: Package[];

    const packageDescription = "Test Package";
    const eventStream = new EventStream();
    eventStream.subscribe(event => eventBus.push(event));

    const platformInfo = new PlatformInformation("win32", "x86");
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);
    const options = {
        key: fs.readFileSync("test/unitTests/testAssets/private.pem"),
        cert: fs.readFileSync("test/unitTests/testAssets/public.pem")
    };

    setup(async () => {
        eventBus = [];
        tmpSourceDir = await CreateTmpDir(true);
        tmpInstallDir = await CreateTmpDir(true);
        installationPath = tmpInstallDir.name;
        allFiles = [...Files, ...Binaries];
        testDirPath = tmpSourceDir.name + "/test.zip";
        await createTestZipAsync(testDirPath, allFiles);
        let port = await getPort();
        packages = [<Package>{ url: `https://localhost:${port}`, description: packageDescription, installPath: installationPath }];
        server = https.createServer(options, (req, response) => {
            let stat = fs.statSync(testDirPath);
            response.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Length': stat.size
            });

            let readStream = fs.createReadStream(testDirPath);
            readStream.pipe(response);
        }).listen(port);
    });

    test("Downloads the package and installs at the specified path", async () => {
        await DownloadAndInstallPackages(packages, networkSettingsProvider, platformInfo, eventStream);
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
            new InstallationProgress('installPackages', packageDescription)
        ];

        await DownloadAndInstallPackages(packages, networkSettingsProvider, platformInfo, eventStream);
        expect(eventBus).to.be.deep.equal(eventsSequence);
    });

    teardown(() => {
        tmpSourceDir.dispose();
        tmpInstallDir.dispose();
        server.close();
    });
});