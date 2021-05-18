/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { EventStream } from '../../../src/EventStream';
import { DownloadFile } from '../../../src/packageManager/FileDownloader';
import NetworkSettings from '../../../src/NetworkSettings';
import { DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess, DownloadFallBack, DownloadFailure } from '../../../src/omnisharp/loggingEvents';
import MockHttpsServer from '../testAssets/MockHttpsServer';
import TestEventBus from '../testAssets/TestEventBus';

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
    let eventBus: TestEventBus;
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
            new DownloadFailure(`Failed to download from ${server.baseUrl}${errorUrlPath}. Error code '404')`),
            new DownloadFallBack(`${server.baseUrl}${correctUrlPath}`),
            new DownloadSizeObtained(12),
            new DownloadProgress(100, fileDescription),
            new DownloadSuccess(' Done!')];
    };

    let server: MockHttpsServer;

    setup(async () => {
        server = await MockHttpsServer.CreateMockHttpsServer();
        await server.start();
        eventBus = new TestEventBus(eventStream);
        server.addRequestHandler('GET', correctUrlPath, 200, { "content-type": "text/plain" }, "Test content");
        server.addRequestHandler('GET', errorUrlPath, 404);
        server.addRequestHandler('GET', redirectUrlPath, 301, { "location": `${server.baseUrl}${correctUrlPath}` });
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
                    await DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(elem.urlPath), getURL(elem.fallBackUrlPath));
                    expect(eventBus.getEvents()).to.be.deep.equal(elem.getEventSequence());
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
            const downloadPromise = DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(errorUrlPath));
            try {
                await downloadPromise;
            }
            catch { }
            expect(downloadPromise).be.rejected;
        });

        test('Download Start and Download Failure events are created', async () => {
            let eventsSequence = [
                new DownloadStart(fileDescription),
                new DownloadFailure(`Failed to download from ${server.baseUrl}${errorUrlPath}. Error code '404')`)
            ];
            try {
                await DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(errorUrlPath));
            }
            catch (error) {
                expect(eventBus.getEvents()).to.be.deep.equal(eventsSequence);
            }
        });
    });

    teardown(async () => {
        await server.stop();
        eventBus.dispose();
    });

    function getURL(urlPath: string) {
        return `${server.baseUrl}${urlPath}`;
    }
});


