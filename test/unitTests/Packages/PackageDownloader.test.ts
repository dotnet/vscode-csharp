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
import { BaseEvent, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, DownloadFallBack } from '../../../src/omnisharp/loggingEvents';

let ServerMock = require("mock-http-server");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.use(require('chai-arrays'));
let expect = chai.expect;

suite("PackageDownloader", () => {
    let server = new ServerMock(null,
        {
            host: "localhost",
            port: 9002,
            key: fs.readFileSync("test/unitTests/testAssets/private.pem"),
            cert: fs.readFileSync("test/unitTests/testAssets/public.pem")
        });
    
    let tmpFile: TmpFile;
    const eventStream = new EventStream();
    const fileDescription = "Test file";

    setup(function (done) {
        server.start(done);
    });

    setup(async () => {
        tmpFile = await createTmpFile();
        util.setExtensionPath(tmpFile.name);
    });

    suite('Response status Code is 200', () => {
        const requestHandlerOptions = {
            method: 'GET',
            path: '/resource',
            reply: {
                status: 200,
                headers: { "content-type": "text/plain" },
                body: "Test content"
            }
        };
        [
            {
                description: "Download succeeds from the primary url",
                url: "https://127.0.0.1:9002/resource",
                fallBackUrl: "", 
                eventsSequence: [DownloadStart.name, DownloadSizeObtained.name, DownloadProgress.name, DownloadSuccess.name]
            },
            {
                description: "Download succeeds from the fallback url",
                url: "",
                fallBackUrl: "https://127.0.0.1:9002/resource",
                eventsSequence: [DownloadStart.name, DownloadFallBack.name, DownloadSizeObtained.name, DownloadProgress.name, DownloadSuccess.name]
            }
        ].forEach((elem) => {
            suite(elem.description, () => {
                test('File is downloaded', async () => {
                    server.on(requestHandlerOptions);
                    await DownloadPackage(tmpFile.fd, fileDescription, elem.url, elem.fallBackUrl, eventStream, () => new NetworkSettings(undefined, false));
                    const stats = fs.statSync(tmpFile.name);
                    expect(stats.size).to.not.equal(0);
                    let text = fs.readFileSync(tmpFile.name, "utf8");
                    expect(text).to.be.equal("Test content");
                });
            
                test('Events are created in the correct order', async () => {
                    server.on(requestHandlerOptions);
                    let eventBus: BaseEvent[] = [];
                    eventStream.subscribe((event) => eventBus.push(event));
                    await DownloadPackage(tmpFile.fd, fileDescription, elem.url, elem.fallBackUrl, eventStream, () => new NetworkSettings(undefined, false));
                    let eventNames = eventBus.map(elem => elem.constructor.name);
                    //Check whether these events appear in the expected order
                    expect(eventNames).to.have.ordered.members(elem.eventsSequence);
                });
            });
        });
    });

    /*suite('Response Status Code is 301', () => {
        const url = "https://127.0.0.1:9002/resource";
        const requestHandlerOptions = {
            method: 'GET',
            path: '/getResource',
            reply: {
                status: 301,
                headers: {
                    "location": url
                },
            }
        };

        const requestHandlerOptionsRedirect = {
            method: 'GET',
            path: '/resource',
            reply: {
                status: 200,
                headers: {
                    "content-type": "text/plain",
                },
                body: "Test content"
            }
        };

        test('File is downloaded from the redirect url', async () => {
            server.on(requestHandlerOptions);
            server.on(requestHandlerOptionsRedirect);
            await DownloadPackage(tmpFile.fd, description, url, "", eventStream, () => new NetworkSettings(undefined, false));
            const stats = fs.statSync(tmpFile.name);
            expect(stats.size).to.not.equal(0);
            let text = fs.readFileSync(tmpFile.name, "utf8");
            expect(text).to.be.equal("Test content");
        });
    });*/

    teardown(function (done) {
        server.stop(done);

        if (tmpFile) {
            tmpFile.dispose();
        }
    });
});
