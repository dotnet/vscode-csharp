/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmnisharpManager } from '../../src/omnisharp/omnisharpManager';
import MockHttpsServer from './testAssets/mockHttpsServer';
import TestZip from './testAssets/testZip';
import { createTestFile } from './testAssets/testFile';
import { PlatformInformation } from '../../src/shared/platform';
import { OmnisharpDownloader } from '../../src/omnisharp/omnisharpDownloader';
import NetworkSettings from '../../src/networkSettings';
import { EventStream } from '../../src/eventStream';
import { testPackageJSON } from './testAssets/testAssets';
import { TmpAsset, CreateTmpDir, CreateTmpFile } from '../../src/createTmpAsset';
import { expect } from 'chai';
import * as path from 'path';
import * as util from '../../src/common';
import { modernNetVersion } from '../../src/omnisharp/omnisharpPackageCreator';

suite(OmnisharpManager.name, () => {
    let server: MockHttpsServer;
    const eventStream = new EventStream();
    let manager: OmnisharpManager;
    const defaultVersion = '0.1.2';
    const testVersion = '1.2.3';
    const latestVersion = '2.3.4';
    const installPath = '.omnisharp';
    let tmpInstallDir: TmpAsset;
    let extensionPath: string;
    let tmpFile: TmpAsset | undefined;
    let testZip: TestZip;
    let useFramework: boolean;
    let suffix: string;

    [
        {
            platformInfo: new PlatformInformation('win32', 'x86'),
            platformId: 'win-x86',
            useFramework: false,
        },
        {
            platformInfo: new PlatformInformation('win32', 'x86'),
            platformId: 'win-x86',
            useFramework: true,
        },
        {
            platformInfo: new PlatformInformation('win32', 'x86_64'),
            platformId: 'win-x64',
            useFramework: false,
        },
        {
            platformInfo: new PlatformInformation('win32', 'x86_64'),
            platformId: 'win-x64',
            useFramework: true,
        },
        {
            platformInfo: new PlatformInformation('linux', 'x86_64'),
            platformId: 'linux-x64',
            useFramework: false,
        },
        {
            platformInfo: new PlatformInformation('linux', 'x86_64'),
            platformId: 'linux-x64',
            useFramework: true,
        },
        {
            platformInfo: new PlatformInformation('linux', 'x86'),
            platformId: 'linux-x86',
            useFramework: false,
        },
        {
            platformInfo: new PlatformInformation('linux', 'x86'),
            platformId: 'linux-x86',
            useFramework: true,
        },
        {
            platformInfo: new PlatformInformation('darwin', 'x86'),
            platformId: 'osx',
            useFramework: false,
        },
        {
            platformInfo: new PlatformInformation('darwin', 'x86'),
            platformId: 'osx',
            useFramework: true,
        },
    ].forEach((elem) => {
        suite(elem.platformInfo.toString(), () => {
            setup(async () => {
                server = await MockHttpsServer.CreateMockHttpsServer();
                await server.start();
                tmpInstallDir = await CreateTmpDir(true);
                extensionPath = tmpInstallDir.name;
                manager = GetTestOmniSharpManager(elem.platformInfo, eventStream, extensionPath, server.baseUrl);
                testZip = await TestZip.createTestZipAsync(createTestFile('Foo', 'foo.txt'));
                useFramework = elem.useFramework;
                suffix = useFramework ? '' : `-net${modernNetVersion}`;
                server.addRequestHandler(
                    'GET',
                    `/releases/${testVersion}/omnisharp-${elem.platformId}${suffix}.zip`,
                    200,
                    {
                        'content-type': 'application/zip',
                        'content-length': testZip.size,
                    },
                    testZip.buffer
                );

                server.addRequestHandler(
                    'GET',
                    `/releases/versioninfo.txt`,
                    200,
                    {
                        'content-type': 'application/text',
                    },
                    latestVersion
                );

                server.addRequestHandler(
                    'GET',
                    `/releases/${latestVersion}/omnisharp-${elem.platformId}${suffix}.zip`,
                    200,
                    {
                        'content-type': 'application/zip',
                        'content-length': testZip.size,
                    },
                    testZip.buffer
                );
            });

            test('Throws error if the path is neither an absolute path nor a valid semver, nor the string "latest"', async () => {
                expect(
                    manager.GetOmniSharpLaunchPath(defaultVersion, 'Some incorrect path', useFramework, extensionPath)
                ).to.be.rejectedWith(Error);
            });

            test('Throws error when the specified path is an invalid semver', async () => {
                expect(
                    manager.GetOmniSharpLaunchPath(defaultVersion, 'a.b.c', useFramework, extensionPath)
                ).to.be.rejectedWith(Error);
            });

            test('Returns the same path if absolute path to an existing file is passed', async () => {
                tmpFile = await CreateTmpFile();
                const launchPath = await manager.GetOmniSharpLaunchPath(
                    defaultVersion,
                    tmpFile.name,
                    useFramework,
                    extensionPath
                );
                expect(launchPath).to.be.equal(tmpFile.name);
            });

            test('Returns the default path if the omnisharp path is empty', async () => {
                const launchPath = await manager.GetOmniSharpLaunchPath(
                    defaultVersion,
                    '',
                    useFramework,
                    extensionPath
                );
                if (useFramework) {
                    if (elem.platformInfo.isWindows()) {
                        expect(launchPath).to.be.equal(
                            path.join(extensionPath, '.omnisharp', defaultVersion + suffix, 'OmniSharp.exe')
                        );
                    } else {
                        expect(launchPath).to.be.equal(
                            path.join(extensionPath, '.omnisharp', defaultVersion, 'omnisharp', 'OmniSharp.exe')
                        );
                    }
                } else {
                    expect(launchPath).to.be.equal(
                        path.join(extensionPath, '.omnisharp', defaultVersion + suffix, 'OmniSharp.dll')
                    );
                }
            });

            test('Installs the latest version and returns the launch path ', async () => {
                const launchPath = await manager.GetOmniSharpLaunchPath(
                    defaultVersion,
                    'latest',
                    useFramework,
                    extensionPath
                );
                if (useFramework) {
                    if (elem.platformInfo.isWindows()) {
                        expect(launchPath).to.be.equal(
                            path.join(extensionPath, installPath, latestVersion + suffix, 'OmniSharp.exe')
                        );
                    } else {
                        expect(launchPath).to.be.equal(
                            path.join(extensionPath, installPath, latestVersion, 'omnisharp', 'OmniSharp.exe')
                        );
                    }
                } else {
                    expect(launchPath).to.be.equal(
                        path.join(extensionPath, installPath, latestVersion + suffix, 'OmniSharp.dll')
                    );
                }
            });

            test('Installs the test version and returns the launch path', async () => {
                const launchPath = await manager.GetOmniSharpLaunchPath(
                    defaultVersion,
                    testVersion,
                    useFramework,
                    extensionPath
                );
                if (useFramework) {
                    if (elem.platformInfo.isWindows()) {
                        expect(launchPath).to.be.equal(
                            path.join(extensionPath, installPath, testVersion + suffix, 'OmniSharp.exe')
                        );
                    } else {
                        expect(launchPath).to.be.equal(
                            path.join(extensionPath, installPath, testVersion, 'omnisharp', 'OmniSharp.exe')
                        );
                    }
                } else {
                    expect(launchPath).to.be.equal(
                        path.join(extensionPath, installPath, testVersion + suffix, 'OmniSharp.dll')
                    );
                }
            });

            test('Downloads package from given url and installs them at the specified path', async () => {
                await manager.GetOmniSharpLaunchPath(defaultVersion, testVersion, useFramework, extensionPath);
                for (const elem of testZip.files) {
                    const filePath = path.join(extensionPath, installPath, testVersion + suffix, elem.path);
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
    return new OmnisharpManager(downloader, platformInfo, serverUrl);
}
