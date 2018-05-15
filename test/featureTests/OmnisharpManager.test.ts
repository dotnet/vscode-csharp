/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../../src/common';
import { expect, should } from "chai";
import { PlatformInformation } from "../../src/platform";
import { rimraf } from 'async-file';
import { OmnisharpManager } from '../../src/omnisharp/OmnisharpManager';
import { EventStream } from '../../src/EventStream';
import { GetTestOmnisharpDownloader } from './testAssets/testAssets';

const chai = require("chai");
chai.use(require("chai-as-promised"));

const tmp = require('tmp');

suite('GetExperimentalOmnisharpPath : Returns Omnisharp experiment path depending on the path and useMono option', () => {
    const platformInfo = new PlatformInformation("win32", "x86");
    const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
    const installPath = "somePath";
    const versionFilepathInServer = "releases/testVersionInfo.txt";
    const eventStream = new EventStream();
    const manager = GetTestOmnisharpManager(eventStream, platformInfo);
    const defaultVersion = "0.1.2";
    let extensionPath: string;
    let tmpDir: any;
    let tmpFile: any;

    suiteSetup(() => should());

    setup(() => {
        tmpDir = tmp.dirSync();
        extensionPath = tmpDir.name;
        util.setExtensionPath(tmpDir.name);
    });

    test('Throws error if the path is neither an absolute path nor a valid semver, nor the string "latest"', async () => {
        expect(manager.GetOmniSharpLaunchInfo(defaultVersion, "Some incorrect path", serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is null', async () => {
        expect(manager.GetOmniSharpLaunchInfo(defaultVersion, null, serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is empty', async () => {
        expect(manager.GetOmniSharpLaunchInfo(defaultVersion, "", serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is an invalid semver', async () => {
        expect(manager.GetOmniSharpLaunchInfo(defaultVersion, "a.b.c", serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Returns default paths if no path is specified', async () => {
        let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, undefined, serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchInfo.LaunchPath.should.equal(path.resolve(extensionPath, `.omnisharp/${defaultVersion}/OmniSharp.exe`));
        expect(launchInfo.MonoLaunchPath).to.be.undefined;
    });

    test('Returns default paths if no path is specified - Linux ', async () => {
        let manager = GetTestOmnisharpManager(eventStream, new PlatformInformation("linux", "x64"));
        let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, undefined, serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchInfo.LaunchPath.should.equal(path.resolve(extensionPath, `.omnisharp/${defaultVersion}/run`));
        launchInfo.MonoLaunchPath.should.equal(path.resolve(extensionPath, `.omnisharp/${defaultVersion}/omnisharp/OmniSharp.exe`));
    });

    test('Returns the same path if absolute path to an existing file is passed', async () => {
        tmpFile = tmp.fileSync();
        let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, tmpFile.name, serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchInfo.LaunchPath.should.equal(tmpFile.name);
    });

    test('Installs the latest version and returns the launch path based on the version and platform', async () => {
        let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, "latest", serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchInfo.LaunchPath.should.equal(path.resolve(extensionPath, `somePath/1.2.3/OmniSharp.exe`));
        expect(launchInfo.MonoLaunchPath).to.be.undefined;
    });

    test('Installs the test version and returns the launch path based on the version and platform', async () => {
        let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, "1.2.3", serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchInfo.LaunchPath.should.equal(path.resolve(extensionPath, `somePath/1.2.3/OmniSharp.exe`));
        expect(launchInfo.MonoLaunchPath).to.be.undefined;
    });

    test('Downloads package from given url and installs them at the specified path', async () => {
        await manager.GetOmniSharpLaunchInfo(defaultVersion, "1.2.3", serverUrl, versionFilepathInServer, installPath, extensionPath);
        let exists = await util.fileExists(path.resolve(extensionPath, `somePath/1.2.3/install_check_1.2.3.txt`));
        exists.should.equal(true);
    });

    test('Downloads package and returns launch path based on platform - on Linux ', async () => {
        let manager = GetTestOmnisharpManager(eventStream, new PlatformInformation("linux", "x64"));
        let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, "1.2.3", serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchInfo.LaunchPath.should.equal(path.resolve(extensionPath, 'somePath/1.2.3/run'));
        launchInfo.MonoLaunchPath.should.equal(path.resolve(extensionPath, 'somePath/1.2.3/omnisharp/OmniSharp.exe'));
    });

    test('Downloads package and returns launch path based on install path ', async () => {
        let manager = GetTestOmnisharpManager(eventStream, platformInfo);
        let launchInfo = await manager.GetOmniSharpLaunchInfo(defaultVersion, "1.2.3", serverUrl, versionFilepathInServer, "installHere", extensionPath);
        launchInfo.LaunchPath.should.equal(path.resolve(extensionPath, 'installHere/1.2.3/OmniSharp.exe'));
        expect(launchInfo.MonoLaunchPath).to.be.undefined;
    });

    teardown(async () => {
        if (tmpDir) {
            await rimraf(tmpDir.name);
        }

        if (tmpFile) {
            tmpFile.removeCallback();
        }

        tmpFile = null;
        tmpDir = null;
    });
});

function GetTestOmnisharpManager(eventStream: EventStream, platformInfo: PlatformInformation) {
    let downloader = GetTestOmnisharpDownloader(eventStream, platformInfo);
    return new OmnisharpManager(downloader, platformInfo);
}
