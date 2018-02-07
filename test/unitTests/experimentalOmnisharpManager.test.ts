/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as util from '../../src/common';
import { should, expect } from "chai";
import { PlatformInformation } from "../../src/platform";
import { GetLaunchPathForVersion, ExperimentalOmnisharpManager } from "../../src/omnisharp/experimentalOmnisharpManager";
import { Logger } from '../../src/logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { rimraf } from 'async-file';

suite('Returns Omnisharp Launch Path based on the specified parameters', () => {

    let platformInfo: PlatformInformation;
    let version: string;
    let installPath: string;
    let extensionPath: string;
    let useMono: boolean;

    suiteSetup(() => {
        platformInfo = new PlatformInformation("win32", "x86");
        version = "1.1.1";
        installPath = ".omnisharp/experimental";
        useMono = false;
        const extension = vscode.extensions.getExtension('ms-vscode.csharp');
        util.setExtensionPath(extension.extensionPath);
        extensionPath = util.getExtensionPath();
        should();
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
});

suite('Installs the version packages and returns the launch path', () => {
    let version: string;
    let serverUrl: string;
    let installPath: string;
    let useMono: boolean;
    let extensionPath: string;
    let manager: ExperimentalOmnisharpManager;

    suiteSetup(() => {
        version = "1.2.3";
        serverUrl = "https://roslynomnisharp.blob.core.windows.net";
        installPath = ".omnisharp/experimental/";
        useMono = false;
        const extension = vscode.extensions.getExtension('ms-vscode.csharp');
        util.setExtensionPath(extension.extensionPath);
        extensionPath = util.getExtensionPath();
        manager = GetExperimentalOmnisharpManager();
        should();
    });

    test('Downloads package and returns launch path based on version', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath("1.2.4", useMono, serverUrl, installPath, extensionPath, new PlatformInformation("win32", "x86"));
        let dirPath = path.resolve(extensionPath, `.omnisharp/experimental/1.2.4`);
        await rimraf(dirPath);
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.4/OmniSharp.exe'));
    });

    test('Downloads package from given url and installs them at the specified path', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath(version, useMono, serverUrl, installPath, extensionPath, new PlatformInformation("win32", "x86"));
        let dirPath = path.resolve(extensionPath, `.omnisharp/experimental/1.2.3`);

        let exists = await util.fileExists(path.resolve(dirPath, `install_check_1.2.3.txt`));
        await rimraf(dirPath);
        exists.should.equal(true);
    });

    test('Downloads package and returns launch path based on platform - Not using mono on Linux ', async () => {
        let launchPath = await manager.InstallVersionAndReturnLaunchPath(version, useMono, serverUrl, installPath, extensionPath, new PlatformInformation("linux", "x64"));
        let dirPath = path.resolve(extensionPath, `.omnisharp/experimental/1.2.3`);
        await rimraf(dirPath);
        launchPath.should.equal(path.resolve(extensionPath, '.omnisharp/experimental/1.2.3/run'));
    });
});

function GetExperimentalOmnisharpManager() {
    let channel = vscode.window.createOutputChannel('Experiment Channel');
    let logger = new Logger(text => channel.append(text));
    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);
    return new ExperimentalOmnisharpManager(channel, logger, reporter, extension.packageJSON);
}