/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as chaiAsPromised from 'chai-as-promised';
import * as chai from "chai";
import * as util from '../../../src/common';
import { CreateTmpDir, TmpAsset } from '../../../src/CreateTmpAsset';
import TestZip from '../testAssets/TestZip';
import { downloadAndInstallPackages } from '../../../src/packageManager/downloadAndInstallPackages';
import NetworkSettings from '../../../src/NetworkSettings';
import { EventStream } from '../../../src/EventStream';
import { DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, InstallationStart, PackageInstallStart } from '../../../src/omnisharp/loggingEvents';
import MockHttpsServer from '../testAssets/MockHttpsServer';
import { createTestFile } from '../testAssets/TestFile';
import TestEventBus from '../testAssets/TestEventBus';
import { AbsolutePathPackage } from '../../../src/packageManager/AbsolutePathPackage';
import { AbsolutePath } from '../../../src/packageManager/AbsolutePath';

chai.use(chaiAsPromised);
let expect = chai.expect;

suite(`${downloadAndInstallPackages.name}`, () => {
    let tmpInstallDir: TmpAsset;
    let server: MockHttpsServer;
    let testZip: TestZip;
    let tmpDirPath: string;
    let eventStream: EventStream;
    let eventBus: TestEventBus;
    let downloadablePackage: AbsolutePathPackage[];
    let notDownloadablePackage: AbsolutePathPackage[];

    const packageDescription = "Test Package";
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);

    setup(async () => {
        eventStream = new EventStream();
        server = await MockHttpsServer.CreateMockHttpsServer();
        eventBus = new TestEventBus(eventStream);
        tmpInstallDir = await CreateTmpDir(true);
        tmpDirPath = tmpInstallDir.name;
        downloadablePackage = <AbsolutePathPackage[]>[
            {
                url: `${server.baseUrl}/downloadablePackage`,
                description: packageDescription,
                installPath: new AbsolutePath(tmpDirPath)
            }];

        notDownloadablePackage = <AbsolutePathPackage[]>[
            {
                url: `${server.baseUrl}/notDownloadablePackage`,
                description: packageDescription,
                installPath: new AbsolutePath(tmpDirPath)
            }];

        testZip = await TestZip.createTestZipAsync(createTestFile("Foo", "foo.txt"));
        await server.start();
        server.addRequestHandler('GET', '/downloadablePackage', 200, {
            "content-type": "application/zip",
            "content-length": testZip.size
        }, testZip.buffer);

        server.addRequestHandler('GET', '/notDownloadablePackage', 404);
    });

    suite("If the download and install succeeds", () => {
        test("The expected files are installs at the specified path", async () => {
            await downloadAndInstallPackages(downloadablePackage, networkSettingsProvider, eventStream);
            for (let elem of testZip.files) {
                let filePath = path.join(tmpDirPath, elem.path);
                expect(await util.fileExists(filePath)).to.be.true;
            }
        });

        test("install.Lock is present", async () => {
            await downloadAndInstallPackages(downloadablePackage, networkSettingsProvider, eventStream);
            for (let elem of testZip.files) {
                let filePath = path.join(tmpDirPath, elem.path);
                expect(await util.fileExists(filePath)).to.be.true;
            }

            expect(await util.fileExists(path.join(tmpDirPath, "install.Lock"))).to.be.true;
        });

        test("Events are created in the correct order", async () => {
            let eventsSequence = [
                new PackageInstallStart(),
                new DownloadStart(packageDescription),
                new DownloadSizeObtained(testZip.size),
                new DownloadProgress(100, packageDescription),
                new DownloadSuccess(' Done!'),
                new InstallationStart(packageDescription)
            ];

            await downloadAndInstallPackages(downloadablePackage, networkSettingsProvider, eventStream);
            console.log(eventBus.getEvents());
            expect(eventBus.getEvents()).to.be.deep.equal(eventsSequence);
        });
    });

    suite("If the download and install fails", () => {
        test("Throws an exception when the download fails", async () => {
            await downloadAndInstallPackages(notDownloadablePackage, networkSettingsProvider, eventStream).should.be.rejected;
        });

        test("install.Lock is not present when the download fails", async () => {
            try {
                await downloadAndInstallPackages(notDownloadablePackage, networkSettingsProvider, eventStream);
            } 
            catch (error) {
                expect(await util.fileExists(path.join(tmpDirPath, "install.Lock"))).to.be.false;
            }
        });
    });

    teardown(async () => {
        if (tmpInstallDir) {
            tmpInstallDir.dispose();
        }

        await server.stop();
        eventBus.dispose();
    });
});
