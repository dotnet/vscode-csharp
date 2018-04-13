/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as tmp from 'tmp';
import * as util from '../../../src/common';
import { rimraf } from 'async-file';
import { EventStream } from '../../../src/EventStream';
import { DownloadPackage } from '../../../src/packageManager/PackageDownloader';
import NetworkSettings from '../../../src/NetworkSettings';
import { TmpFile, createTmpFile } from '../../../src/CreateTmpFile';

let ServerMock = require("mock-http-server");
const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite("PackageDownloader : The package is downloaded ", () => {
    let server = new ServerMock({ host: "127.0.0.1", port: 9001 },
        {
            host: "localhost",
            port: 9002,
            key: fs.readFileSync("test/unitTests/testAssets/private.pem"),
            cert: fs.readFileSync("test/unitTests/testAssets/public.pem")
        });

    let tmpFile: TmpFile;
    const eventStream = new EventStream();
    const serverUrl = "https://127.0.0.1:9002";

    setup(function (done) {
        server.start(done);
    });

    setup(async () => {
        tmpFile = await createTmpFile();
        util.setExtensionPath(tmpFile.name);
    });

    test('Packages are downloaded from the specified server url and installed at the specified path', async () => {
        server.on({
            method: 'GET',
            path: '/resource',
            reply: {
                status: 200,
                headers: { "content-type": "text/plain" },
                body: "something"
            }
        });

        let description = "Latest version information file";
        let url = `${serverUrl}/resource`;

        try {
            await DownloadPackage(tmpFile.fd, description, url, "", eventStream, () => new NetworkSettings(undefined, false));
        }
        catch (error) {
            console.log(error);
        }

        const stats = fs.statSync(tmpFile.name);
        expect(stats.size).to.not.equal(0);
    });

    teardown(function (done) {
        server.stop(done);

        if (tmpFile) {
            tmpFile.dispose();
        }
    });
});
