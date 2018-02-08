/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as util from '../../src/common';
import { should } from "chai";
import { PlatformInformation } from "../../src/platform";
import { GetLaunchPathForVersion, ExperimentalOmnisharpManager } from "../../src/omnisharp/experimentalOmnisharp.Manager";
import { Logger } from '../../src/logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { rimraf } from 'async-file';
import { GetTestPackageJSON } from './experimentalOmnisharpDownloader.test';

const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

const tmp = require('tmp');

suite('GetExperimentalOmnisharpPath : Returns Omnisharp experiment path depending on the path and useMono option', () => {
    const platformInfo = new PlatformInformation("win32", "x86");
    const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
    const installPath = ".omnisharp/experimental";
    let extensionPath: string;
    let tmpDir : any;
    let tmpFile : any;

    suiteSetup(() => should());

    setup(()=>{
        tmpDir = tmp.dirSync();
        extensionPath = tmpDir.name;
        util.setExtensionPath(tmpDir.name);
    });

    test('Returns the same path if absolute path to an existing file is passed', async () => {
        tmpFile = tmp.fileSync();
        let manager = GetExperimentalOmnisharpManager();

        let omnisharpPath = await manager.GetExperimentalOmnisharpPath(tmpFile.name, false, platformInfo, serverUrl, installPath, extensionPath);
        omnisharpPath.should.equal(tmpFile.name);
    });

    test('Throws error if the path is neither an absolute path nor a valid semver', async () => {
        let manager = GetExperimentalOmnisharpManager();
        expect(manager.GetExperimentalOmnisharpPath("Some incorrect path", false, platformInfo, serverUrl,installPath,extensionPath)).to.be.rejectedWith(Error);
    });

    teardown(async () => {
        if (tmpDir) {
            await rimraf(tmpDir.name);
        }

        if(tmpFile){
            tmpFile.removeCallback();
        }
        
        tmpFile = null;
        tmpDir = null;
    });
});

suite('GetLaunchPathForVersion : Returns Omnisharp Launch Path based on the specified parameters', () => {

    let platformInfo: PlatformInformation;
    let version: string;
    let installPath: string;
    let extensionPath: string;
    let useMono: boolean;
    let tmpDir: any;

    suiteSetup(() => {
        platformInfo = new PlatformInformation("win32", "x86");
        version = "1.1.1";
        installPath = ".omnisharp/experimental";
        useMono = false;
        let tmpDir = tmp.dirSync();
        extensionPath = tmpDir.name;
        util.setExtensionPath(tmpDir.name);
        should();
    });

    test("Throws error when version is null", async () => {
        expect(GetLaunchPathForVersion(platformInfo, null, installPath, extensionPath, useMono)).to.be.rejectedWith(Error);
    });

    test("Throws error when version is empty", async () => {
        expect(GetLaunchPathForVersion(platformInfo, "", installPath, extensionPath, useMono)).to.be.rejectedWith(Error);
    });

    test("Returns Launch Path based on install path", async () => {
        let launchPath = await GetLaunchPathForVersion(platformInfo, version, "somePath", extensionPath, useMono);
        launchPath.should.equal(path.resolve(extensionPath, `somePath/1.1.1/OmniSharp.exe`));
    });

    test("Returns Launch Path based on version", async () => {
        let launchPath = await GetLaunchPathForVersion(platformInfo, "0.0.0", installPath, extensionPath, useMono);
        launchPath.should.equal(path.resolve(extensionPath, `.omnisharp/experimental/0.0.0/OmniSharp.exe`));
    });

    test("Returns Launch Path based on platform - Windows", async () => {
        let launchPath = await GetLaunchPathForVersion(platformInfo, version, installPath, extensionPath, useMono);
        launchPath.should.equal(path.resolve(extensionPath, `.omnisharp/experimental/1.1.1/OmniSharp.exe`));
    });

    test("Returns Launch Path based on platform - Unix with Mono", async () => {
        platformInfo = new PlatformInformation("linux", "x86");
        let launchPath = await GetLaunchPathForVersion(platformInfo, version, installPath, extensionPath, true);
        launchPath.should.equal(path.resolve(extensionPath, `.omnisharp/experimental/1.1.1/omnisharp/OmniSharp.exe`));
    });

    test("Returns Launch Path based on platform - Unix without Mono", async () => {
        platformInfo = new PlatformInformation("linux", "x86");
        let launchPath = await GetLaunchPathForVersion(platformInfo, version, installPath, extensionPath, useMono);
        launchPath.should.equal(path.resolve(extensionPath, `.omnisharp/experimental/1.1.1/run`));
    });

    suiteTeardown(async () => {
        if (tmpDir) {
            await rimraf(tmpDir.name);
        }

        tmpDir = null;
    });
});

suite('InstallVersionAndReturnLaunchPath : Installs the version packages and returns the launch path', () => {
    let version: string;
    let serverUrl: string;
    let installPath: string;
    let useMono: boolean;
    let extensionPath: string;
    let manager: ExperimentalOmnisharpManager;
    let platformInfo: PlatformInformation;
    let tmpDir = null;

    suiteSetup(() => {
        version = "1.2.3";
        serverUrl = "https://roslynomnisharp.blob.core.windows.net";
        installPath = ".omnisharp/experimental/";
        useMono = false;
        manager = GetExperimentalOmnisharpManager();
        platformInfo = new PlatformInformation("win32", "x86");
        should();
    });

    setup(() => {
        tmpDir = tmp.dirSync();
        util.setExtensionPath(tmpDir.name);
        extensionPath = util.getExtensionPath();
    });

    test('Throws error when version is null', async () => {
        expect(manager.InstallVersionAndReturnLaunchPath(null, useMono, serverUrl, installPath, extensionPath, platformInfo)).to.be.rejectedWith(Error);
    });

    test('Throws error when version string is empty', async () => {
        expect(manager.InstallVersionAndReturnLaunchPath("", useMono, serverUrl, installPath, extensionPath, platformInfo)).to.be.rejectedWith(Error);
    });

    test('Throws error when version string is invalid semver', async () => {
        expect(manager.InstallVersionAndReturnLaunchPath("a.b.c", useMono, serverUrl, installPath, extensionPath, platformInfo)).to.be.rejectedWith(Error);
    });

    test('Downloads package and returns launch path based on version', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath("1.2.4", useMono, serverUrl, installPath, extensionPath, platformInfo);
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.4/OmniSharp.exe'));
    });

    test('Downloads package from given url and installs them at the specified path', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath(version, useMono, serverUrl, installPath, extensionPath, platformInfo);
        let exists = await util.fileExists(path.resolve(extensionPath, `.omnisharp/experimental/1.2.3/install_check_1.2.3.txt`));
        exists.should.equal(true);
    });

    test('Downloads package and returns launch path based on platform - Not using mono on Linux ', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath(version, useMono, serverUrl, installPath, extensionPath, new PlatformInformation("linux", "x64"));
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.3/run'));
    });

    test('Downloads package and returns launch path based on platform - Using mono on Linux ', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath(version, true, serverUrl, installPath, extensionPath, new PlatformInformation("linux", "x64"));
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.3/omnisharp/OmniSharp.exe'));
    });

    teardown(async () => {
        if (tmpDir) {
            await rimraf(tmpDir.name);
        }

        tmpDir = null;
    });
});

function GetExperimentalOmnisharpManager() {
    let channel = vscode.window.createOutputChannel('Experiment Channel');
    let logger = new Logger(text => channel.append(text));
    return new ExperimentalOmnisharpManager(channel, logger, null, GetTestPackageJSON());
}