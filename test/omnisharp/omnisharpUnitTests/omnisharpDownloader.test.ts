/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { OmnisharpDownloader } from '../../../src/omnisharp/omnisharpDownloader';
import NetworkSettings from '../../../src/networkSettings';
import { EventStream } from '../../../src/eventStream';
import { PlatformInformation } from '../../../src/shared/platform';
import { CreateTmpDir, TmpAsset } from '../../../src/createTmpAsset';
import * as util from '../../../src/common';
import * as path from 'path';
import MockHttpsServer from './testAssets/mockHttpsServer';
import TestZip from './testAssets/testZip';
import { createTestFile } from './testAssets/testFile';
import {
    PackageInstallation,
    LogPlatformInfo,
    DownloadStart,
    DownloadSizeObtained,
    DownloadProgress,
    DownloadSuccess,
    InstallationStart,
    InstallationSuccess,
    PackageInstallStart,
} from '../../../src/shared/loggingEvents';
import TestEventBus from './testAssets/testEventBus';
import { testPackageJSON } from './testAssets/testAssets';
import { modernNetVersion } from '../../../src/omnisharp/omnisharpPackageCreator';

[true, false].forEach((useFramework) => {
    describe(`OmnisharpDownloader (useFramework: ${useFramework})`, () => {
        const networkSettingsProvider = () => new NetworkSettings('', false);
        let eventStream: EventStream;
        const installPath = 'somePath';
        const platformInfo = new PlatformInformation('win32', 'x86_64');
        let downloader: OmnisharpDownloader;
        let server: MockHttpsServer;
        let extensionPath: string;
        const version = '1.2.3';
        let tmpDir: TmpAsset;
        let testZip: TestZip;
        let eventBus: TestEventBus;
        const suffix = useFramework ? '' : `-net${modernNetVersion}`;

        beforeEach(async () => {
            eventStream = new EventStream();
            eventBus = new TestEventBus(eventStream);
            tmpDir = await CreateTmpDir(true);
            extensionPath = tmpDir.name;
            downloader = new OmnisharpDownloader(
                networkSettingsProvider,
                eventStream,
                testPackageJSON,
                platformInfo,
                extensionPath
            );
            server = await MockHttpsServer.CreateMockHttpsServer();
            testZip = await TestZip.createTestZipAsync(createTestFile('Foo', 'foo.txt'));
            await server.start();
            server.addRequestHandler(
                'GET',
                `/releases/${version}/omnisharp-win-x64${suffix}.zip`,
                200,
                {
                    'content-type': 'application/zip',
                    'content-length': testZip.size,
                },
                testZip.buffer
            );
        });

        test('Returns false if request is made for a version that does not exist on the server', async () => {
            expect(
                await downloader.DownloadAndInstallOmnisharp(
                    '1.00000001.0000',
                    useFramework,
                    server.baseUrl,
                    installPath
                )
            ).toBe(false);
        });

        test('Packages are downloaded and installed', async () => {
            await downloader.DownloadAndInstallOmnisharp(version, useFramework, server.baseUrl, installPath);
            for (const elem of testZip.files) {
                const filePath = path.join(extensionPath, installPath, version + suffix, elem.path);
                expect(await util.fileExists(filePath)).toBe(true);
            }
        });

        test('Events are created', async () => {
            const expectedSequence = [
                new PackageInstallation('OmniSharp Version = 1.2.3'),
                new LogPlatformInfo(new PlatformInformation('win32', 'x86_64')),
                new PackageInstallStart(),
                new DownloadStart(
                    `OmniSharp for Windows (.NET ${useFramework ? '4.7.2' : '6'} / x64), Version = 1.2.3`
                ),
                new DownloadSizeObtained(testZip.size),
                new DownloadProgress(
                    100,
                    `OmniSharp for Windows (.NET ${useFramework ? '4.7.2' : '6'} / x64), Version = 1.2.3`
                ),
                new DownloadSuccess(' Done!'),
                new InstallationStart(
                    `OmniSharp for Windows (.NET ${useFramework ? '4.7.2' : '6'} / x64), Version = 1.2.3`
                ),
                new InstallationSuccess(),
            ];

            expect(eventBus.getEvents()).toHaveLength(0);
            await downloader.DownloadAndInstallOmnisharp(version, useFramework, server.baseUrl, installPath);
            expect(eventBus.getEvents()).toStrictEqual(expectedSequence);
        });

        afterEach(async () => {
            tmpDir.dispose();
            await server.stop();
            eventBus.dispose();
        });
    });
});
