/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as util from '../../src/common';
import { should } from "chai";
import { PlatformInformation } from "../../src/platform";
import { Logger } from '../../src/logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { rimraf } from 'async-file';
import { GetTestPackageJSON } from './OmnisharpDownloader.test';
import { GetLaunchPathForVersion, OmnisharpManager } from '../../src/omnisharp/OmnisharpManager';

const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

const tmp = require('tmp');

suite('GetExperimentalOmnisharpPath : Returns Omnisharp experiment path depending on the path and useMono option', () => {
    const platformInfo = new PlatformInformation("win32", "x86");
    const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
    const installPath = ".omnisharp/experimental";
    const useMono = false;
    const manager = GetTestOmnisharpManager();
    let extensionPath: string;
    let tmpDir: any;
    let tmpFile: any;

    suiteSetup(() => should());

    setup(() => {
        tmpDir = tmp.dirSync();
        extensionPath = tmpDir.name;
        util.setExtensionPath(tmpDir.name);
    });

    test('Throws error if the path is neither an absolute path nor a valid semver', async () => {
        expect(manager.GetOmnisharpPath("Some incorrect path", useMono, serverUrl, installPath, extensionPath, platformInfo)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is null', async () => {
        expect(manager.GetOmnisharpPath(null, useMono, serverUrl, installPath, extensionPath, platformInfo)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is empty', async () => {
        expect(manager.GetOmnisharpPath("", useMono, serverUrl, installPath, extensionPath, platformInfo)).to.be.rejectedWith(Error);
    });

    test('Throws error when the specified path is an invalid semver', async () => {
        expect(manager.GetOmnisharpPath("a.b.c", useMono, serverUrl, installPath, extensionPath, platformInfo)).to.be.rejectedWith(Error);
    });

    test('Returns the same path if absolute path to an existing file is passed', async () => {
        tmpFile = tmp.fileSync();
        let omnisharpPath = await manager.GetOmnisharpPath(tmpFile.name, useMono, serverUrl, installPath, extensionPath, platformInfo);
        omnisharpPath.should.equal(tmpFile.name);
    });

    test('Installs the test version and returns the launch path based on the version and platform', async () => {
        let omnisharpPath = await manager.GetOmnisharpPath("1.2.3", useMono, serverUrl, installPath, extensionPath, platformInfo);
        omnisharpPath.should.equal(path.resolve(extensionPath, `.omnisharp/experimental/1.2.3/OmniSharp.exe`));
    });

    test('Downloads package from given url and installs them at the specified path', async () => {
        let launchPath = await manager.GetOmnisharpPath("1.2.3", useMono, serverUrl, installPath, extensionPath, platformInfo);
        let exists = await util.fileExists(path.resolve(extensionPath, `.omnisharp/experimental/1.2.3/install_check_1.2.3.txt`));
        exists.should.equal(true);
    });

    test('Downloads package and returns launch path based on platform - Not using mono on Linux ', async () => {
        let launchPath = await manager.GetOmnisharpPath("1.2.3", useMono, serverUrl, installPath, extensionPath, new PlatformInformation("linux", "x64"));
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.3/run'));
    });

    test('Downloads package and returns launch path based on platform - Using mono on Linux ', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath("1.2.3", true, serverUrl, installPath, extensionPath, new PlatformInformation("linux", "x64"));
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.3/omnisharp/OmniSharp.exe'));
    });

    test('Downloads package and returns launch path based on install path ', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath("1.2.3", true, serverUrl, "installHere", extensionPath, platformInfo);
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

function GetTestOmnisharpManager() {
    let channel = vscode.window.createOutputChannel('Experiment Channel');
    let logger = new Logger(text => channel.append(text));
    return new OmnisharpManager(channel, logger, GetTestPackageJSON(), null);
}