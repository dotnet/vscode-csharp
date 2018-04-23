/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as chai from 'chai';
import * as util from '../../../src/common';
import { EventStream } from '../../../src/EventStream';
import { DownloadFile } from '../../../src/packageManager/FileDownloader';
import NetworkSettings from '../../../src/NetworkSettings';
import { TmpAsset, CreateTmpFile } from '../../../src/CreateTmpAsset';
import { BaseEvent, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, DownloadFallBack, DownloadFailure } from '../../../src/omnisharp/loggingEvents';
import { getResponseHandlerOptions, MockHttpServerRequestOptions } from '../testAssets/MockHttpServerRequestOptions';

const getPort = require('get-port');
const ServerMock = require("mock-http-server");
chai.use(require("chai-as-promised"));
chai.use(require('chai-arrays'));
const expect = chai.expect;

//to do:look into http url thing
suite("FileDownloader", () => {
    const fileDescription = "Test file";
    const correctUrlPath = `/resource`;
    const redirectUrlPath = '/redirectResource';
    const errorUrlPath = '/errorResource';
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);
    const eventStream = new EventStream();
    let eventBus: BaseEvent[];
    eventStream.subscribe((event) => eventBus.push(event));

    let server: any;
    let httpsServerUrl: string;
    let tmpFile: TmpAsset;
    let requestOptions: MockHttpServerRequestOptions;
    let requestOptionsError: MockHttpServerRequestOptions;
    let requestOptionsRedirect: MockHttpServerRequestOptions;
    
    suiteSetup(async () => {
        let port = await getPort();
        server = new ServerMock(null,
            {
                host: "localhost",
                port: port,
                key: fs.readFileSync("test/unitTests/testAssets/private.pem"),
                cert: fs.readFileSync("test/unitTests/testAssets/public.pem")
            });

        httpsServerUrl = `https://127.0.0.1:${port}`;
        requestOptions = getResponseHandlerOptions('GET', correctUrlPath, 200, { "content-type": "text/plain" }, "Test content");
        requestOptionsError = getResponseHandlerOptions('GET', errorUrlPath, 404);
        requestOptionsRedirect = getResponseHandlerOptions('GET', redirectUrlPath, 301, { "location": `${httpsServerUrl}${correctUrlPath}` });
    });


    setup(async () => {
        await new Promise(resolve => server.start(resolve));
        tmpFile = await CreateTmpFile();
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
                urlPath: correctUrlPath,
                fallBackUrlPath: "",
                eventsSequence: [
                    new DownloadStart(fileDescription),
                    new DownloadSizeObtained(12),
                    new DownloadProgress(100, fileDescription),
                    new DownloadSuccess(' Done!')]
            },
            {
                description: "Fallback url",
                urlPath: errorUrlPath,
                fallBackUrlPath: correctUrlPath,
                eventsSequence: [
                    new DownloadStart(fileDescription),
                    new DownloadFailure("failed (error code '404')"),
                    new DownloadFallBack(`${httpsServerUrl}${correctUrlPath}`),
                    new DownloadSizeObtained(12),
                    new DownloadProgress(100, fileDescription),
                    new DownloadSuccess(' Done!')]
            }
        ].forEach((elem) => {
            suite(elem.description, () => {
                test('File is downloaded', async () => {
                    await DownloadFile(tmpFile.fd, fileDescription, `${httpsServerUrl}${elem.urlPath}`, `${httpsServerUrl}${elem.fallBackUrlPath}`, eventStream, networkSettingsProvider);
                    const stats = fs.statSync(tmpFile.name);
                    expect(stats.size).to.not.equal(0);
                    let text = fs.readFileSync(tmpFile.name, "utf8");
                    expect(text).to.be.equal("Test content");
                });

                test('Events are created in the correct order', async () => {
                    await DownloadFile(tmpFile.fd, fileDescription, `${httpsServerUrl}${elem.urlPath}`, `${httpsServerUrl}${elem.fallBackUrlPath}`, eventStream, networkSettingsProvider);
                    expect(eventBus).to.be.deep.equal(elem.eventsSequence);
                });
            });
        });
    });

    suite('If the response status Code is 301, redirect occurs and the download succeeds', () => {
        test('File is downloaded from the redirect url', async () => {
            await DownloadFile(tmpFile.fd, fileDescription, `${httpsServerUrl}${redirectUrlPath}`, "", eventStream, networkSettingsProvider);
            const stats = fs.statSync(tmpFile.name);
            expect(stats.size).to.not.equal(0);
            let text = fs.readFileSync(tmpFile.name, "utf8");
            expect(text).to.be.equal("Test content");
        });
    });

    suite('If the response status code is not 301, 302 or 200 then the download fails', () => {
        test('Error is thrown', async () => {
            expect(DownloadFile(tmpFile.fd, fileDescription, `${httpsServerUrl}${errorUrlPath}`, "", eventStream, networkSettingsProvider)).be.rejectedWith(Error);
        });

        test('Download Start and Download Failure events are created', async () => {
            let eventsSequence = [
                new DownloadStart(fileDescription),
                new DownloadFailure("failed (error code '404')")
            ];
            try {
                await DownloadFile(tmpFile.fd, fileDescription, `${httpsServerUrl}${errorUrlPath}`, "", eventStream, networkSettingsProvider);
            }
            catch (error) {
                expect(eventBus).to.be.deep.equal(eventsSequence);
            }
        });
    });

    test('Error is thrown on invalid input file', async () => {
        //fd=0 means there is no file
        expect(DownloadFile(0, fileDescription, `${httpsServerUrl}${errorUrlPath}`, "", eventStream, networkSettingsProvider)).to.be.rejected;
    });

    teardown(async () => {
        await new Promise((resolve, reject) => server.stop(resolve));
        if (tmpFile) {
            tmpFile.dispose();
        }
    });
});


