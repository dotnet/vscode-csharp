/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as tmp from 'tmp';
import * as util from '../../src/common';
import { rimraf } from 'async-file';
import { PlatformInformation } from '../../src/platform';
import { EventStream } from '../../src/EventStream';
import { GetTestOmnisharpDownloader } from './testAssets/testAssets';

const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite("DownloadAndInstallExperimentalVersion : Gets the version packages, downloads and installs them", () => {
    let tmpDir: tmp.SynchrounousResult = null;
    const version = "1.2.3";
    const platformInfo = new PlatformInformation("win32", "x86");
    const eventStream = new EventStream();
    const downloader = GetTestOmnisharpDownloader(eventStream, platformInfo);
    const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
    const installPath = "somePath";

    setup(() => {
        tmpDir = tmp.dirSync();
        util.setExtensionPath(tmpDir.name);
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
