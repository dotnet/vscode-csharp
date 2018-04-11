/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tmp from 'tmp';
import * as util from '../../src/common';
import { rimraf } from 'async-file';
import { PlatformInformation } from '../../src/platform';
import { EventStream } from '../../src/EventStream';
import { PackageManager, Package } from '../../src/packages';
let ServerMock = require("mock-http-server");
const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite("DownloadAndInstallExperimentalVersion : Gets the version packages, downloads and installs them", () => {
    let server = new ServerMock({ host: "127.0.0.1", port: 9000 });
    let tmpDir: tmp.SynchrounousResult = null;
    const platformInfo = new PlatformInformation("win32", "x86");
    const eventStream = new EventStream();
    const manager = new PackageManager(platformInfo);
    //const serverUrl = "https://roslynomnisharp.blob.core.windows.net";
    const serverUrl = "http://127.0.0.1:9000";

    setup(() => {
        tmpDir = tmp.dirSync();
        util.setExtensionPath(tmpDir.name);
    });

    test('Packages are downloaded from the specified server url and installed at the specified path', function(done){
        /* Download a test package that conatins a install_check_1.2.3.txt file and check whether the 
           file appears at the expected path */
        
           server.on({
            method: 'GET',
            path: '/resource',
            reply: {
                status:  200,
                headers: { "content-type": "text/plain" },
                body:    "1.28.0"
            }
        });
        let packages = Array( <Package>{
            "description": "Latest version information file",
            "url": `${serverUrl}/resource`
        });
        console.log(packages[0].url);
        
        try {
            manager.DownloadPackages(packages, eventStream, undefined, undefined);
        }
        catch (error) {
            console.log(error);
        }

        done();
        //expect(downloadedPackage).to.not.be.empty;
        //expect(downloadedPackage[0].tmpFile).to.not.be.undefined;
    });

    teardown(async () => {
        if (tmpDir) {
            await rimraf(tmpDir.name);
        }

        tmpDir = null;
    });
});
