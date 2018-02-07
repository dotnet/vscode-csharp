/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from '../../src/common';
import { should, assert } from 'chai';
import { Logger } from '../../src/logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { ExperimentalOmnisharpDownloader } from '../../src/omnisharp/experimentalOmnisharpDownloader';
import { rimraf } from 'async-file';

suite("Gets the version packages and downloads and installs them", () => {

    test('Packages are downloaded from the specified server url and installed at the specified path', async () => {
        /* Download a test package that conatins a install_check_1.2.3.txt file and check whether the 
           file appears at the expected path */
        let version = "1.2.3";
        let downloader = GetOmnisharpDownloader();
        let serverUrl = "https://roslynomnisharp.blob.core.windows.net";
        let installPath = ".omnisharp/experimental/";
        let tempDir = path.resolve(util.getExtensionPath(), `.omnisharp/experimental/1.2.3`);
        await downloader.DownloadAndInstallExperimentalVersion(version, serverUrl, installPath);
        let exists = await util.fileExists(path.resolve(tempDir, `install_check_1.2.3.txt`));
        await rimraf(tempDir);
        exists.should.equal(true);
    });
});

function GetOmnisharpDownloader() {
    let channel = vscode.window.createOutputChannel('Experiment Channel');
    let logger = new Logger(text => channel.append(text));
    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);
    util.setExtensionPath(extension.extensionPath);
    return new ExperimentalOmnisharpDownloader(channel, logger, reporter, extension.packageJSON);
}
