/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as util from '../../../src/common';
import { EventStream } from '../../../src/EventStream';
import { DownloadPackage } from '../../../src/packageManager/PackageDownloader';
import NetworkSettings from '../../../src/NetworkSettings';
import { TmpFile, createTmpFile } from '../../../src/CreateTmpFile';
import { BaseEvent, DownloadStart } from '../../../src/omnisharp/loggingEvents';

let ServerMock = require("mock-http-server");
const chai = require("chai");
chai.use(require("chai-as-promised"));
let expect = chai.expect;

suite("PackageDownloader", () => {
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
    const description = "Test file";

    setup(function (done) {
        server.start(done);
    });

    setup(async () => {
        tmpFile = await createTmpFile();
        util.setExtensionPath(tmpFile.name);
    });

    test('File is downloaded from the specified url', async () => {
        server.on({
            method: 'GET',
            path: '/resource',
            reply: {
                status: 200,
                headers: { "content-type": "text/plain" },
                body: "Test content"
            }
        });

        let url = `${serverUrl}/resource`;

        await DownloadPackage(tmpFile.fd, description, url, "", eventStream, () => new NetworkSettings(undefined, false));
        const stats = fs.statSync(tmpFile.name);
        let text = fs.readFileSync(tmpFile.name, "utf8");
        expect(text).to.be.equal("Test content");
        expect(stats.size).to.not.equal(0);
    });

    test('Events is created when the file is downloaded successfully', async () => {
        server.on({
            method: 'GET',
            path: '/resource',
            reply: {
                status: 200,
                headers: { "content-type": "text/plain" },
                body: "Test content"
            }
        });

        let url = `${serverUrl}/resource`;
        let eventBus: BaseEvent[] = [];
        eventStream.subscribe((event) => eventBus.push(event));
        await DownloadPackage(tmpFile.fd, description, url, "", eventStream, () => new NetworkSettings(undefined, false));
        console.log(eventBus);
        //expect(eventBus).to.include([new DownloadStart('Test file')]);
    });

    teardown(function (done) {
        server.stop(done);

        if (tmpFile) {
            tmpFile.dispose();
        }
    });
});
