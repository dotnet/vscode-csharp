/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { OmnisharpManager } from '../../../src/omnisharp/omnisharpManager';
import MockHttpsServer from './testAssets/mockHttpsServer';
import TestZip from './testAssets/testZip';
import { createTestFile } from './testAssets/testFile';
import { PlatformInformation } from '../../../src/shared/platform';
import { OmnisharpDownloader } from '../../../src/omnisharp/omnisharpDownloader';
import NetworkSettings from '../../../src/networkSettings';
import { EventStream } from '../../../src/eventStream';
import { testPackageJSON } from './testAssets/testAssets';
import { TmpAsset, CreateTmpDir, CreateTmpFile } from '../../createTmpAsset';
import * as path from 'path';
import * as util from '../../../src/common';
import { getPackageSuffix } from '../../../src/omnisharp/omnisharpPackageCreator';

describe(OmnisharpManager.name, () => {
    let server: MockHttpsServer;
    const eventStream = new EventStream();
    let manager: OmnisharpManager;
    const defaultVersion = '0.1.2';
    const testVersion = '1.2.3';
    const installPath = '.omnisharp';
    let tmpInstallDir: TmpAsset;
    let extensionPath: string;
    let tmpFile: TmpAsset | undefined;
    let testZip: TestZip;
    let suffix: string;

    [
        {
            platformInfo: new PlatformInformation('win32', 'x86_64'),
            platformId: 'win-x64',
        },
        {
            platformInfo: new PlatformInformation('linux', 'x86_64'),
            platformId: 'linux-x64',
        },
        {
            platformInfo: new PlatformInformation('linux', 'x86'),
            platformId: 'linux-x86',
        },
        {
            platformInfo: new PlatformInformation('darwin', 'x86'),
            platformId: 'osx',
        },
    ].forEach((elem) => {
        describe(`${elem.platformInfo.toString()},${elem.platformId}`, () => {
            beforeEach(async () => {
                server = await MockHttpsServer.CreateMockHttpsServer();
                await server.start();
                tmpInstallDir = await CreateTmpDir(true);
                extensionPath = tmpInstallDir.name;
                manager = GetTestOmniSharpManager(elem.platformInfo, eventStream, extensionPath, server.baseUrl);
                testZip = await TestZip.createTestZipAsync(createTestFile('Foo', 'foo.txt'));
                suffix = getPackageSuffix(testVersion);
                server.addRequestHandler(
                    'GET',
                    `/releases/download/v${testVersion}/omnisharp-${elem.platformId}${suffix}.zip`,
                    200,
                    {
                        'content-type': 'application/zip',
                        'content-length': testZip.size,
                    },
                    testZip.buffer
                );
            });

            test('Throws error if the path is neither an absolute path nor a valid semver', async () => {
                await expect(
                    manager.GetOmniSharpLaunchPath(defaultVersion, 'Some incorrect path', extensionPath)
                ).rejects.toThrowError(Error);
            });

            test('Throws error when the specified path is an invalid semver', async () => {
                await expect(
                    manager.GetOmniSharpLaunchPath(defaultVersion, 'a.b.c', extensionPath)
                ).rejects.toThrowError(Error);
            });

            test('Throws error when the specified path is "latest"', async () => {
                await expect(
                    manager.GetOmniSharpLaunchPath(defaultVersion, 'latest', extensionPath)
                ).rejects.toThrowError('Invalid OmniSharp version - latest');
            });

            test('Returns the same path if absolute path to an existing file is passed', async () => {
                tmpFile = await CreateTmpFile();
                const launchPath = await manager.GetOmniSharpLaunchPath(defaultVersion, tmpFile.name, extensionPath);
                expect(launchPath).toEqual(tmpFile.name);
            });

            test('Returns the default path if the omnisharp path is empty', async () => {
                const launchPath = await manager.GetOmniSharpLaunchPath(defaultVersion, '', extensionPath);
                expect(launchPath).toEqual(
                    path.join(
                        extensionPath,
                        '.omnisharp',
                        defaultVersion + getPackageSuffix(defaultVersion),
                        'OmniSharp.dll'
                    )
                );
            });

            test('Installs the test version and returns the launch path', async () => {
                const launchPath = await manager.GetOmniSharpLaunchPath(defaultVersion, testVersion, extensionPath);
                expect(launchPath).toEqual(
                    path.join(extensionPath, installPath, testVersion + suffix, 'OmniSharp.dll')
                );
            });

            test('Downloads package from given url and installs them at the specified path', async () => {
                await manager.GetOmniSharpLaunchPath(defaultVersion, testVersion, extensionPath);
                for (const elem of testZip.files) {
                    const filePath = path.join(extensionPath, installPath, testVersion + suffix, elem.path);
                    expect(await util.fileExists(filePath)).toBe(true);
                }
            });
        });
    });

    afterEach(async () => {
        await server.stop();
        if (tmpFile) {
            tmpFile.dispose();
            tmpFile = undefined;
        }
        tmpInstallDir.dispose();
        extensionPath = '';
    });
});

function GetTestOmniSharpManager(
    platformInfo: PlatformInformation,
    eventStream: EventStream,
    extensionPath: string,
    serverUrl: string
): OmnisharpManager {
    const downloader = new OmnisharpDownloader(
        () => new NetworkSettings('', false),
        eventStream,
        testPackageJSON,
        platformInfo,
        extensionPath
    );
    return new OmnisharpManager(downloader, serverUrl);
}
