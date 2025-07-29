/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';
import * as util from '../../../../src/common';
import { CreateTmpDir, TmpAsset } from '../../../../src/createTmpAsset';
import TestZip from '../testAssets/testZip';
import { downloadAndInstallPackages } from '../../../../src/packageManager/downloadAndInstallPackages';
import NetworkSettings from '../../../../src/networkSettings';
import { EventStream } from '../../../../src/eventStream';
import {
    DownloadStart,
    DownloadSizeObtained,
    DownloadProgress,
    DownloadSuccess,
    InstallationStart,
    PackageInstallStart,
    IntegrityCheckFailure,
    DownloadFailure,
    InstallationFailure,
} from '../../../../src/shared/loggingEvents';
import MockHttpsServer from '../testAssets/mockHttpsServer';
import { createTestFile } from '../testAssets/testFile';
import TestEventBus from '../testAssets/testEventBus';
import { AbsolutePathPackage } from '../../../../src/packageManager/absolutePathPackage';
import { AbsolutePath } from '../../../../src/packageManager/absolutePath';
import { DownloadValidator } from '../../../../src/packageManager/isValidDownload';

describe(`${downloadAndInstallPackages.name}`, () => {
    let tmpInstallDir: TmpAsset;
    let server: MockHttpsServer;
    let testZip: TestZip;
    let tmpDirPath: string;
    let eventStream: EventStream;
    let eventBus: TestEventBus;
    let downloadablePackage: AbsolutePathPackage[];
    let notDownloadablePackage: AbsolutePathPackage[];
    const downloadValidator: DownloadValidator = () => true;

    const packageDescription = 'Test Package';
    const networkSettingsProvider = () => new NetworkSettings('', false);

    beforeEach(async () => {
        eventStream = new EventStream();
        server = await MockHttpsServer.CreateMockHttpsServer();
        eventBus = new TestEventBus(eventStream);
        tmpInstallDir = await CreateTmpDir(true);
        tmpDirPath = tmpInstallDir.name;
        downloadablePackage = <AbsolutePathPackage[]>[
            {
                url: `${server.baseUrl}/downloadablePackage`,
                description: packageDescription,
                installPath: new AbsolutePath(tmpDirPath),
            },
        ];

        notDownloadablePackage = <AbsolutePathPackage[]>[
            {
                url: `${server.baseUrl}/notDownloadablePackage`,
                description: packageDescription,
                installPath: new AbsolutePath(tmpDirPath),
            },
        ];

        testZip = await TestZip.createTestZipAsync(createTestFile('Foo', 'foo.txt'));
        await server.start();
        server.addRequestHandler(
            'GET',
            '/downloadablePackage',
            200,
            {
                'content-type': 'application/zip',
                'content-length': testZip.size,
            },
            testZip.buffer
        );

        server.addRequestHandler('GET', '/notDownloadablePackage', 404);
    });

    describe('If the download and install succeeds', () => {
        test('The expected files are installed at the specified path', async () => {
            await downloadAndInstallPackages(
                downloadablePackage,
                networkSettingsProvider,
                eventStream,
                downloadValidator
            );
            for (const elem of testZip.files) {
                const filePath = path.join(tmpDirPath, elem.path);
                expect(await util.fileExists(filePath)).toBe(true);
            }
        });

        test('install.Lock is present', async () => {
            await downloadAndInstallPackages(
                downloadablePackage,
                networkSettingsProvider,
                eventStream,
                downloadValidator
            );
            expect(await util.fileExists(path.join(tmpDirPath, 'install.Lock'))).toBe(true);
        });

        test('Events are created in the correct order', async () => {
            const eventsSequence = [
                new PackageInstallStart(),
                new DownloadStart(packageDescription),
                new DownloadSizeObtained(testZip.size),
                new DownloadProgress(100, packageDescription),
                new DownloadSuccess(' Done!'),
                new InstallationStart(packageDescription),
            ];

            await downloadAndInstallPackages(
                downloadablePackage,
                networkSettingsProvider,
                eventStream,
                downloadValidator
            );
            expect(eventBus.getEvents()).toStrictEqual(eventsSequence);
        });

        test('If the download validation fails for the first time and passed second time, the correct events are logged', async () => {
            let count = 1;
            const downloadValidator = () => {
                if (count > 1) {
                    return true; // fail the first time and then pass the subsequent times
                }

                count++;
                return false;
            };

            const eventsSequence = [
                new PackageInstallStart(),
                new DownloadStart(packageDescription),
                new DownloadSizeObtained(testZip.size),
                new DownloadProgress(100, packageDescription),
                new DownloadSuccess(' Done!'),
                new IntegrityCheckFailure(packageDescription, downloadablePackage[0].url, true),
                new DownloadStart(packageDescription),
                new DownloadSizeObtained(testZip.size),
                new DownloadProgress(100, packageDescription),
                new DownloadSuccess(' Done!'),
                new InstallationStart(packageDescription),
            ];

            await downloadAndInstallPackages(
                downloadablePackage,
                networkSettingsProvider,
                eventStream,
                downloadValidator
            );
            expect(eventBus.getEvents()).toStrictEqual(eventsSequence);
        });
    });

    describe('If the download and install fails', () => {
        test('If the download succeeds but the validation fails, events are logged', async () => {
            const downloadValidator = () => false;
            const eventsSequence = [
                new PackageInstallStart(),
                new DownloadStart(packageDescription),
                new DownloadSizeObtained(testZip.size),
                new DownloadProgress(100, packageDescription),
                new DownloadSuccess(' Done!'),
                new IntegrityCheckFailure(packageDescription, downloadablePackage[0].url, true),
                new DownloadStart(packageDescription),
                new DownloadSizeObtained(testZip.size),
                new DownloadProgress(100, packageDescription),
                new DownloadSuccess(' Done!'),
                new IntegrityCheckFailure(packageDescription, downloadablePackage[0].url, false),
            ];

            await downloadAndInstallPackages(
                downloadablePackage,
                networkSettingsProvider,
                eventStream,
                downloadValidator
            );
            expect(eventBus.getEvents()).toStrictEqual(eventsSequence);
        });

        test('Returns false when the download fails', async () => {
            const eventsSequence = [
                new PackageInstallStart(),
                new DownloadStart(packageDescription),
                new DownloadFailure(`Failed to download from ${notDownloadablePackage[0].url}. Error code '404')`),
            ];

            await downloadAndInstallPackages(
                notDownloadablePackage,
                networkSettingsProvider,
                eventStream,
                downloadValidator
            );
            const obtainedEvents = eventBus.getEvents();
            expect(obtainedEvents[0]).toStrictEqual(eventsSequence[0]);
            expect(obtainedEvents[1]).toStrictEqual(eventsSequence[1]);
            expect(obtainedEvents[2]).toStrictEqual(eventsSequence[2]);
            const installationFailureEvent = <InstallationFailure>obtainedEvents[3];
            expect(installationFailureEvent.stage).toEqual('downloadPackage');
            expect(installationFailureEvent.error).not.toBe(null);
        });

        test('install.Lock is not present when the download fails', async () => {
            await downloadAndInstallPackages(
                notDownloadablePackage,
                networkSettingsProvider,
                eventStream,
                downloadValidator
            );
            expect(await util.fileExists(path.join(tmpDirPath, 'install.Lock'))).toBe(false);
        });
    });

    afterEach(async () => {
        if (tmpInstallDir) {
            tmpInstallDir.dispose();
        }

        await server.stop();
        eventBus.dispose();
    });
});
