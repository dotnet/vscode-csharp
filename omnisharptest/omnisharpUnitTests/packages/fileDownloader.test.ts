/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { EventStream } from '../../../src/eventStream';
import { DownloadFile } from '../../../src/packageManager/fileDownloader';
import NetworkSettings from '../../../src/networkSettings';
import {
    DownloadStart,
    DownloadSizeObtained,
    DownloadProgress,
    DownloadSuccess,
    DownloadFallBack,
    DownloadFailure,
} from '../../../src/omnisharp/loggingEvents';
import MockHttpsServer from '../../omnisharpUnitTests/testAssets/mockHttpsServer';
import TestEventBus from '../../omnisharpUnitTests/testAssets/testEventBus';

describe('FileDownloader', () => {
    const fileDescription = 'Test file';
    const correctUrlPath = `/resource`;
    const redirectUrlPath = '/redirectResource';
    const errorUrlPath = '/errorResource';
    const networkSettingsProvider = () => new NetworkSettings('', false);
    const eventStream = new EventStream();
    let eventBus: TestEventBus;
    const getPrimaryURLEvents = () => {
        return [
            new DownloadStart(fileDescription),
            new DownloadSizeObtained(12),
            new DownloadProgress(100, fileDescription),
            new DownloadSuccess(' Done!'),
        ];
    };

    const getFallBackURLEvents = () => {
        return [
            new DownloadStart(fileDescription),
            new DownloadFailure(`Failed to download from ${server.baseUrl}${errorUrlPath}. Error code '404')`),
            new DownloadFallBack(`${server.baseUrl}${correctUrlPath}`),
            new DownloadSizeObtained(12),
            new DownloadProgress(100, fileDescription),
            new DownloadSuccess(' Done!'),
        ];
    };

    let server: MockHttpsServer;

    beforeEach(async () => {
        server = await MockHttpsServer.CreateMockHttpsServer();
        await server.start();
        eventBus = new TestEventBus(eventStream);
        server.addRequestHandler('GET', correctUrlPath, 200, { 'content-type': 'text/plain' }, 'Test content');
        server.addRequestHandler('GET', errorUrlPath, 404);
        server.addRequestHandler('GET', redirectUrlPath, 301, { location: `${server.baseUrl}${correctUrlPath}` });
    });

    describe('If the response status Code is 200, the download succeeds', () => {
        [
            {
                description: 'Primary url',
                urlPath: correctUrlPath,
                fallBackUrlPath: '',
                getEventSequence: getPrimaryURLEvents,
            },
            {
                description: 'Fallback url',
                urlPath: errorUrlPath,
                fallBackUrlPath: correctUrlPath,
                getEventSequence: getFallBackURLEvents,
            },
        ].forEach((elem) => {
            describe(elem.description, () => {
                test('File is downloaded', async () => {
                    const buffer = await DownloadFile(
                        fileDescription,
                        eventStream,
                        networkSettingsProvider,
                        getURL(elem.urlPath),
                        getURL(elem.fallBackUrlPath)
                    );
                    const text = buffer.toString('utf8');
                    expect(text).toEqual('Test content');
                });

                test('Events are created in the correct order', async () => {
                    await DownloadFile(
                        fileDescription,
                        eventStream,
                        networkSettingsProvider,
                        getURL(elem.urlPath),
                        getURL(elem.fallBackUrlPath)
                    );
                    expect(eventBus.getEvents()).toStrictEqual(elem.getEventSequence());
                });
            });
        });
    });

    describe('If the response status Code is 301, redirect occurs and the download succeeds', () => {
        test('File is downloaded from the redirect url', async () => {
            const buffer = await DownloadFile(
                fileDescription,
                eventStream,
                networkSettingsProvider,
                getURL(redirectUrlPath)
            );
            const text = buffer.toString('utf8');
            expect(text).toEqual('Test content');
        });
    });

    describe('If the response status code is not 301, 302 or 200 then the download fails', () => {
        test('Error is thrown', async () => {
            const downloadPromise = DownloadFile(
                fileDescription,
                eventStream,
                networkSettingsProvider,
                getURL(errorUrlPath)
            );
            try {
                await downloadPromise;
            } catch {
                /* empty */
            }
            expect(downloadPromise).rejects.toThrow();
        });

        test('Download Start and Download Failure events are created', async () => {
            const eventsSequence = [
                new DownloadStart(fileDescription),
                new DownloadFailure(`Failed to download from ${server.baseUrl}${errorUrlPath}. Error code '404')`),
            ];
            try {
                await DownloadFile(fileDescription, eventStream, networkSettingsProvider, getURL(errorUrlPath));
            } catch (error) {
                expect(eventBus.getEvents()).toStrictEqual(eventsSequence);
            }
        });
    });

    afterEach(async () => {
        await server.stop();
        eventBus.dispose();
    });

    function getURL(urlPath: string) {
        return `${server.baseUrl}${urlPath}`;
    }
});
