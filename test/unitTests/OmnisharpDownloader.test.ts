/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as util from '../../src/common';
import { should } from 'chai';
import { Logger } from '../../src/logger';
import { OmnisharpDownloader } from '../../src/omnisharp/OmnisharpDownloader';
import { rimraf } from 'async-file';

const tmp = require('tmp');
const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite("DownloadAndInstallExperimentalVersion : Gets the version packages, downloads and installs them", () => {
    let tmpDir = null;
    const version = "1.2.3";
    const downloader = GetOmnisharpDownloader();
    const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
    const installPath = ".omnisharp/experimental/";

    setup(() => {
        tmpDir = tmp.dirSync();
        util.setExtensionPath(tmpDir.name);
    });

    test('Throws error if version is null', () => {
        expect(downloader.DownloadAndInstallOmnisharp(null, serverUrl, installPath)).to.be.rejectedWith(Error);
    });

    test('Throws error if version is empty string', () => {
        expect(downloader.DownloadAndInstallOmnisharp("", serverUrl, installPath)).to.be.rejectedWith(Error);
    });

    test('Throws error if request is made for a version that doesnot exist on the server', () => {
        expect(downloader.DownloadAndInstallOmnisharp("1.00000001.0000", serverUrl, installPath)).to.be.rejectedWith(Error);
    });

    test('Packages are downloaded from the specified server url and installed at the specified path', async () => {
        /* Download a test package that conatins a install_check_1.2.3.txt file and check whether the 
           file appears at the expected path */
        await downloader.DownloadAndInstallOmnisharp(version, serverUrl, installPath);
        let exists = await util.fileExists(path.resolve(tmpDir.name, installPath, version, `install_check_1.2.3.txt`));
        exists.should.equal(true);
    });

    teardown(async () => {
        if (tmpDir) {
            await rimraf(tmpDir.name);
        }

        tmpDir = null;
    });
});

function GetOmnisharpDownloader() {
    let channel = vscode.window.createOutputChannel('Experiment Channel');
    let logger = new Logger(text => channel.append(text));
    return new OmnisharpDownloader(channel, logger, GetTestPackageJSON(), null);
}

//Since we need only the runtime dependencies of packageJSON for the downloader create a testPackageJSON
//with just that
export function GetTestPackageJSON() {
    let testpackageJSON = {
        "runtimeDependencies": [
            {
                "description": "OmniSharp for Windows (.NET 4.6 / x86)",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505823/5804b7d3b5eeb7e4ae812a7cff03bd52/omnisharp-win-x86-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x86-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "win32"
                ],
                "architectures": [
                    "x86"
                ],
                "installTestPath": "./.omnisharp/OmniSharp.exe",
                "experimentalPackageId": "win-x86"
            },
            {
                "description": "OmniSharp for Windows (.NET 4.6 / x64)",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505821/c570a9e20dbf7172f79850babd058872/omnisharp-win-x64-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-win-x64-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "win32"
                ],
                "architectures": [
                    "x86_64"
                ],
                "installTestPath": "./.omnisharp/OmniSharp.exe",
                "experimentalPackageId": "win-x64"
            },
            {
                "description": "OmniSharp for OSX",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505818/6b99c6a86da3221919158ca0f36a3e45/omnisharp-osx-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-osx-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "darwin"
                ],
                "binaries": [
                    "./mono.osx",
                    "./run"
                ],
                "installTestPath": "./.omnisharp/mono.osx",
                "experimentalPackageId": "osx"
            },
            {
                "description": "OmniSharp for Linux (x86)",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505817/b710ec9c2bedc0cfdb57da82da166c47/omnisharp-linux-x86-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-linux-x86-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "linux"
                ],
                "architectures": [
                    "x86",
                    "i686"
                ],
                "binaries": [
                    "./mono.linux-x86",
                    "./run"
                ],
                "installTestPath": "./.omnisharp/mono.linux-x86",
                "experimentalPackageId": "linux-x86"
            },
            {
                "description": "OmniSharp for Linux (x64)",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505485/3f8a10409240decebb8a3189429f3fdf/omnisharp-linux-x64-1.28.0.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-linux-x64-1.28.0.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "linux"
                ],
                "architectures": [
                    "x86_64"
                ],
                "binaries": [
                    "./mono.linux-x86_64",
                    "./run"
                ],
                "installTestPath": "./.omnisharp/mono.linux-x86_64",
                "experimentalPackageId": "linux-x64"
            },
            {
                "description": "OmniSharp for Test OS(architecture)",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100505485/3f8a10409240decebb8a3189429f3fdf/omnisharp-os-architecture-version.zip",
                "fallbackUrl": "https://omnisharpdownload.blob.core.windows.net/ext/omnisharp-os-architecture-version.zip",
                "installPath": ".omnisharp",
                "platforms": [
                    "platform1"
                ],
                "architectures": [
                    "architecture"
                ],
                "binaries": [
                    "./binary1",
                    "./binary2"
                ],
                "installTestPath": "./.omnisharp/binary",
                "experimentalPackageId": "os-architecture"
            },
            {
                "description": "Non omnisharp package without experimentalPackageID",
                "url": "https://download.visualstudio.microsoft.com/download/pr/100317420/a30d7e11bc435433d297adc824ee837f/coreclr-debug-win7-x64.zip",
                "fallbackUrl": "https://vsdebugger.blob.core.windows.net/coreclr-debug-1-14-4/coreclr-debug-win7-x64.zip",
                "installPath": ".debugger",
                "platforms": [
                    "win32"
                ],
                "architectures": [
                    "x86_64"
                ],
                "installTestPath": "./.debugger/vsdbg-ui.exe"
            }
        ]
    };

    return testpackageJSON;
}
