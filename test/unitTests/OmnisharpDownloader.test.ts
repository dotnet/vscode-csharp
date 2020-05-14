/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmnisharpDownloader } from "../../src/omnisharp/OmnisharpDownloader";
import NetworkSettings from "../../src/NetworkSettings";
import { EventStream } from "../../src/EventStream";
import { PlatformInformation } from "../../src/platform";
import { CreateTmpDir, TmpAsset } from "../../src/CreateTmpAsset";
import * as util from '../../src/common';
import * as path from 'path';
import MockHttpsServer from "./testAssets/MockHttpsServer";
import { expect } from 'chai';
import TestZip from "./testAssets/TestZip";
import { createTestFile } from "./testAssets/TestFile";
import { PackageInstallation, LogPlatformInfo, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, InstallationStart, InstallationSuccess, PackageInstallStart } from "../../src/omnisharp/loggingEvents";
import TestEventBus from "./testAssets/TestEventBus";
import { testPackageJSON } from "./testAssets/testAssets";

suite('OmnisharpDownloader', () => {
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);
    let eventStream: EventStream;
    const installPath = "somePath";
    let platformInfo = new PlatformInformation("win32", "x86");
    let downloader: OmnisharpDownloader;
    let server: MockHttpsServer;
    let extensionPath: string;
    const version = "1.2.3";
    let tmpDir: TmpAsset;
    let testZip: TestZip;
    let eventBus: TestEventBus;

    setup(async () => {
        eventStream = new EventStream();
        eventBus = new TestEventBus(eventStream);
        tmpDir = await CreateTmpDir(true);
        extensionPath = tmpDir.name;
        downloader = new OmnisharpDownloader(networkSettingsProvider, eventStream, testPackageJSON, platformInfo, extensionPath);
        server = await MockHttpsServer.CreateMockHttpsServer();
        testZip = await TestZip.createTestZipAsync(createTestFile("Foo", "foo.txt"));
        await server.start();
        server.addRequestHandler('GET', `/releases/${version}/omnisharp-win-x86.zip`, 200, {
            "content-type": "application/zip",
            "content-length": testZip.size
        }, testZip.buffer);
    });

    test('Returns false if request is made for a version that doesnot exist on the server', async () => {
        expect(await downloader.DownloadAndInstallOmnisharp("1.00000001.0000", server.baseUrl, installPath)).to.be.false;
    });

    test('Packages are downloaded and installed', async () => {
        await downloader.DownloadAndInstallOmnisharp(version, server.baseUrl, installPath);
        for (let elem of testZip.files) {
            let filePath = path.join(extensionPath, installPath, version, elem.path);
            expect(await util.fileExists(filePath)).to.be.true;
        }
    });

    test('Events are created', async () => {
        let expectedSequence = [
            new PackageInstallation('OmniSharp Version = 1.2.3'),
            new LogPlatformInfo(new PlatformInformation("win32", "x86")),
            new PackageInstallStart(),
            new DownloadStart('OmniSharp for Windows (.NET 4.6 / x86), Version = 1.2.3'),
            new DownloadSizeObtained(testZip.size),
            new DownloadProgress(100, 'OmniSharp for Windows (.NET 4.6 / x86), Version = 1.2.3'),
            new DownloadSuccess(' Done!'),
            new InstallationStart('OmniSharp for Windows (.NET 4.6 / x86), Version = 1.2.3'),
            new InstallationSuccess()
        ];

        expect(eventBus.getEvents()).to.be.empty;
        await downloader.DownloadAndInstallOmnisharp(version, server.baseUrl, installPath);
        expect(eventBus.getEvents()).to.be.deep.equal(expectedSequence);
    });

    teardown(async () => {
        tmpDir.dispose();
        await server.stop();
        eventBus.dispose();
    });
});