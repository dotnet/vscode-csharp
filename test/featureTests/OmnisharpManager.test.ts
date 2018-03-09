/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../../src/common';
import { should } from "chai";
import { PlatformInformation } from "../../src/platform";
import { rimraf } from 'async-file';
import { GetTestOmnisharpDownloader } from './OmnisharpDownloader.test';
import { OmnisharpManager } from '../../src/omnisharp/OmnisharpManager';
import { Subject } from 'rx';
import { OmnisharpDownloader } from '../../src/omnisharp/OmnisharpDownloader';
import { BaseEvent } from '../../src/omnisharp/loggingEvents';

const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

const tmp = require('tmp');

suite('GetExperimentalOmnisharpPath : Returns Omnisharp experiment path depending on the path and useMono option', () => {
    const platformInfo = new PlatformInformation("win32", "x86");
    const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
    const installPath = ".omnisharp/experimental";
    const versionFilepathInServer = "releases/testVersionInfo.txt";
    const useMono = false;
    const sink = new Subject<BaseEvent>();
    const manager = GetTestOmnisharpManager(sink, platformInfo);
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
        expect(manager.GetOmnisharpPath("Some incorrect path", useMono, serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is null', async () => {
        expect(manager.GetOmnisharpPath(null, useMono, serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is empty', async () => {
        expect(manager.GetOmnisharpPath("", useMono, serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is an invalid semver', async () => {
        expect(manager.GetOmnisharpPath("a.b.c", useMono, serverUrl, versionFilepathInServer, installPath, extensionPath)).to.be.rejectedWith(Error);
    });

    test('Returns the same path if absolute path to an existing file is passed', async () => {
        tmpFile = tmp.fileSync();
        let omnisharpPath = await manager.GetOmnisharpPath(tmpFile.name, useMono, serverUrl, versionFilepathInServer, installPath, extensionPath);
        omnisharpPath.should.equal(tmpFile.name);
    });

    test('Installs the latest version and returns the launch path based on the version and platform', async () => {
        let omnisharpPath = await manager.GetOmnisharpPath("latest", useMono, serverUrl, versionFilepathInServer, installPath, extensionPath);
        omnisharpPath.should.equal(path.resolve(extensionPath, `.omnisharp/experimental/1.2.3/OmniSharp.exe`));
    });

    test('Installs the test version and returns the launch path based on the version and platform', async () => {
        let omnisharpPath = await manager.GetOmnisharpPath("1.2.3", useMono, serverUrl, versionFilepathInServer, installPath, extensionPath);
        omnisharpPath.should.equal(path.resolve(extensionPath, `.omnisharp/experimental/1.2.3/OmniSharp.exe`));
    });

    test('Downloads package from given url and installs them at the specified path', async () => {
        let launchPath = await manager.GetOmnisharpPath("1.2.3", useMono, serverUrl, versionFilepathInServer, installPath, extensionPath);
        let exists = await util.fileExists(path.resolve(extensionPath, `.omnisharp/experimental/1.2.3/install_check_1.2.3.txt`));
        exists.should.equal(true);
    });

    test('Downloads package and returns launch path based on platform - Not using mono on Linux ', async () => {
        let manager = GetTestOmnisharpManager(sink, new PlatformInformation("linux", "x64"));
        let launchPath = await manager.GetOmnisharpPath("1.2.3", useMono, serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.3/run'));
    });

    test('Downloads package and returns launch path based on platform - Using mono on Linux ', async () => {
        let manager = GetTestOmnisharpManager(sink, new PlatformInformation("linux", "x64"));
        let launchPath = await manager.GetOmnisharpPath("1.2.3", true, serverUrl, versionFilepathInServer, installPath, extensionPath);
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.3/omnisharp/OmniSharp.exe'));
    });

    test('Downloads package and returns launch path based on install path ', async () => {
        let manager = GetTestOmnisharpManager(sink, new PlatformInformation("linux", "x64"));
        let launchPath = await manager.GetOmnisharpPath("1.2.3", true, serverUrl, versionFilepathInServer, "installHere", extensionPath);
        launchPath.should.equal(path.resolve(extensionPath, 'installHere/1.2.3/OmniSharp.exe'));
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

function GetTestOmnisharpManager(sink: Subject<BaseEvent>, platformInfo: PlatformInformation) {
    let downloader = GetTestOmnisharpDownloader(sink, platformInfo);
    return new OmnisharpManager(downloader, platformInfo);
}
