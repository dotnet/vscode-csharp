/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as chai from 'chai';
import * as util from '../../../src/common';
import { EventStream } from '../../../src/EventStream';
import { DownloadPackage } from '../../../src/packageManager/PackageDownloader';
import NetworkSettings from '../../../src/NetworkSettings';
import { TmpAsset, createTmpFile } from '../../../src/CreateTmpAsset';
import { BaseEvent, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, DownloadFallBack, DownloadFailure } from '../../../src/omnisharp/loggingEvents';

let ServerMock = require("mock-http-server");
chai.use(require("chai-as-promised"));
chai.use(require('chai-arrays'));
let expect = chai.expect;

//to do: fail on http
//to do: test for proxy
suite("PackageDownloader", () => {
    let server = new ServerMock({ host: "localhost", port: 9000 },
        {
            host: "localhost",
            port: 8080,
            key: fs.readFileSync("test/unitTests/testAssets/private.pem"),
            cert: fs.readFileSync("test/unitTests/testAssets/public.pem")
        });

    let tmpFile: TmpAsset;
    const eventStream = new EventStream();
    const fileDescription = "Test file";
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);
    let eventBus: BaseEvent[];
    eventStream.subscribe((event) => eventBus.push(event));
    const httpsServerUrl = "https://127.0.0.1:8080";
    const correctUrlPath = `/resource`;
    const redirectUrlPath = '/redirectResource';
    const errorUrlPath = '/errorResource';
    const correctUrl = `${httpsServerUrl}${correctUrlPath}`;
    const redirectUrl = `${httpsServerUrl}${redirectUrlPath}`;
    const errorUrl = `${httpsServerUrl}${errorUrlPath}`;

    const requestOptions = {
        method: 'GET',
        path: correctUrlPath,
        reply: {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: "Test content"
        }
    };

    const requestOptionsRedirect = {
        method: 'GET',
        path: redirectUrlPath,
        reply: {
            status: 301,
            headers: {
                "location": correctUrl
            },
        }
    };

    const requestOptionsError = {
        method: 'GET',
        path: errorUrlPath,
        reply: {
            status: 404,
        }
    };

    setup(async () => {
        await new Promise(resolve => server.start(resolve));
        tmpFile = await createTmpFile();
        util.setExtensionPath(tmpFile.name);
        eventBus = [];
        server.on(requestOptions);
        server.on(requestOptionsError);
        server.on(requestOptionsRedirect);
    });

    suite('If the response status Code is 200, the download succeeds', () => {

        [
            {
                description: "Primary url",
                url: correctUrl,
                fallBackUrl: "",
                eventsSequence: [
                    new DownloadStart(fileDescription),
                    new DownloadSizeObtained(12),
                    new DownloadProgress(100, fileDescription),
                    new DownloadSuccess(' Done!')]
            },
            {
                description: "Fallback url",
                url: errorUrl,
                fallBackUrl: correctUrl,
                eventsSequence: [
                    new DownloadStart(fileDescription),
                    new DownloadFailure("failed (error code '404')"),
                    new DownloadFallBack(correctUrl),
                    new DownloadSizeObtained(12),
                    new DownloadProgress(100, fileDescription),
                    new DownloadSuccess(' Done!')]
            }
        ].forEach((elem) => {
            suite(elem.description, () => {
                test('File is downloaded', async () => {
                    await DownloadPackage(tmpFile.fd, fileDescription, elem.url, elem.fallBackUrl, eventStream, networkSettingsProvider);
                    const stats = fs.statSync(tmpFile.name);
                    expect(stats.size).to.not.equal(0);
                    let text = fs.readFileSync(tmpFile.name, "utf8");
                    expect(text).to.be.equal("Test content");
                });

                test('Events are created in the correct order', async () => {
                    await DownloadPackage(tmpFile.fd, fileDescription, elem.url, elem.fallBackUrl, eventStream, networkSettingsProvider);
                    expect(eventBus).to.be.deep.equal(elem.eventsSequence);
                });
            });
        });
    });

    suite('If the response status Code is 301, redirect occurs and the download succeeds', () => {
        test('File is downloaded from the redirect url', async () => {
            await DownloadPackage(tmpFile.fd, fileDescription, redirectUrl, "", eventStream, networkSettingsProvider);
            const stats = fs.statSync(tmpFile.name);
            expect(stats.size).to.not.equal(0);
            let text = fs.readFileSync(tmpFile.name, "utf8");
            expect(text).to.be.equal("Test content");
        });
    });

    suite('If the response status code is not 301, 302 or 200 then the download fails', () => {
        test('Error is thrown', async () => {
            expect(DownloadPackage(tmpFile.fd, fileDescription, errorUrl, "", eventStream, networkSettingsProvider)).be.rejectedWith(Error);
        });

        test('Download Start and Download Failure events are created', () => {

        });
    });

    /*test('Fails if http url is provided', async () => {
        await DownloadPackage(tmpFile.fd, fileDescription, "http://127.0.0.1/resource", "", eventStream, networkSettingsProvider);
    });*/

    teardown(async () => {
        await new Promise((resolve, reject) => server.stop(resolve));
        if (tmpFile) {
            tmpFile.dispose();
        }
    });
});
