/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as chai from 'chai';
import { EventStream } from '../../../src/EventStream';
import { DownloadFile } from '../../../src/packageManager/FileDownloader';
import NetworkSettings from '../../../src/NetworkSettings';
import { BaseEvent, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, DownloadFallBack, DownloadFailure } from '../../../src/omnisharp/loggingEvents';
import { getRequestHandler } from '../testAssets/MockHttpServerRequestHandler';

const getPort = require('get-port');
const ServerMock = require("mock-http-server");
chai.use(require("chai-as-promised"));
chai.use(require('chai-arrays'));
const expect = chai.expect;

suite("FileDownloader", () => {
    const fileDescription = "Test file";
    const correctUrlPath = `/resource`;
    const redirectUrlPath = '/redirectResource';
    const errorUrlPath = '/errorResource';
    const networkSettingsProvider = () => new NetworkSettings(undefined, false);
    const eventStream = new EventStream();
    let eventBus: BaseEvent[];
    const getPrimaryURLEvents = () => {
        return [
            new DownloadStart(fileDescription),
            new DownloadSizeObtained(12),
            new DownloadProgress(100, fileDescription),
            new DownloadSuccess(' Done!')];
    };

    const getFallBackURLEvents = () => {
        return [
            new DownloadStart(fileDescription),
            new DownloadFailure("failed (error code '404')"),
            new DownloadFallBack(`${httpsServerUrl}${correctUrlPath}`),
            new DownloadSizeObtained(12),
            new DownloadProgress(100, fileDescription),
            new DownloadSuccess(' Done!')];
    };
    eventStream.subscribe((event) => eventBus.push(event));

    let server: any;
    let httpsServerUrl: string;

    suiteSetup(async () => {
        let port = await getPort();
        server = new ServerMock(null,
            {
                host: "localhost",
                port: port,
                key: await fs.readFile("test/unitTests/testAssets/private.pem"),
                cert: await fs.readFile("test/unitTests/testAssets/public.pem")
            });

        httpsServerUrl = `https://127.0.0.1:${port}`;
    });


    setup(async () => {
        await new Promise(resolve => server.start(resolve));
        eventBus = [];
        server.on(getRequestHandler('GET', correctUrlPath, 200, { "content-type": "text/plain" }, "Test content"));
        server.on(getRequestHandler('GET', errorUrlPath, 404));
        server.on(getRequestHandler('GET', redirectUrlPath, 301, { "location": `${httpsServerUrl}${correctUrlPath}` }));
    });

    suite('If the response status Code is 200, the download succeeds', () => {

        [
            {
                description: "Primary url",
                urlPath: correctUrlPath,
                fallBackUrlPath: "",
                getEventSequence: getPrimaryURLEvents
            },
            {
                description: "Fallback url",
                urlPath: errorUrlPath,
                fallBackUrlPath: correctUrlPath,
                getEventSequence: getFallBackURLEvents
            }
        ].forEach((elem) => {
            suite(elem.description, () => {
                test('File is downloaded', async () => {
                    let buffer = await DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(elem.urlPath), getURL(elem.fallBackUrlPath));
                    let text = buffer.toString('utf8');
                    expect(text).to.be.equal("Test content");
                });

                test('Events are created in the correct order', async () => {
                    await DownloadFile(fileDescription, eventStream, networkSettingsProvider,  getURL(elem.urlPath), getURL(elem.fallBackUrlPath));
                    expect(eventBus).to.be.deep.equal(elem.getEventSequence());
                });
            });
        });
    });

    suite('If the response status Code is 301, redirect occurs and the download succeeds', () => {
        test('File is downloaded from the redirect url', async () => {
            let buffer = await DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(redirectUrlPath));
            let text = buffer.toString('utf8');
            expect(text).to.be.equal("Test content");
        });
    });

    suite('If the response status code is not 301, 302 or 200 then the download fails', () => {
        test('Error is thrown', async () => {
            expect(DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(errorUrlPath))).be.rejected;
        });

        test('Download Start and Download Failure events are created', async () => {
            let eventsSequence = [
                new DownloadStart(fileDescription),
                new DownloadFailure("failed (error code '404')")
            ];
            try {
                await DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(errorUrlPath));
            }
            catch (error) {
                expect(eventBus).to.be.deep.equal(eventsSequence);
            }
        });
    });

    teardown(async () => {
        await new Promise((resolve, reject) => server.stop(resolve));
    });

    function getURL(urlPath: string) {
        return `${httpsServerUrl}${urlPath}`;
    }
});


