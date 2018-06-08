/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getLatestOmniSharpVersion } from "../../src/omnisharp/GetLatestOmniSharpVersion";
import MockHttpsServer from "./testAssets/MockHttpsServer";
import { EventStream } from "../../src/EventStream";
import NetworkSettings, { NetworkSettingsProvider } from "../../src/NetworkSettings";
import { expect } from 'chai';
import TestEventBus from "./testAssets/TestEventBus";
import { LatestBuildDownloadStart, DownloadStart, DownloadSizeObtained, DownloadProgress, DownloadSuccess } from "../../src/omnisharp/loggingEvents";

suite(getLatestOmniSharpVersion.name, () => {
    let server: MockHttpsServer;
    let eventStream: EventStream;
    let networkSettingsProvider: NetworkSettingsProvider;
    let eventBus: TestEventBus;
    const latestVersion = "some version";
    const latestPath = "somePath";
    const invalidPath = "InvalidPath";

    setup(async () => {
        eventStream = new EventStream();
        eventBus = new TestEventBus(eventStream);
        networkSettingsProvider = () => new NetworkSettings(undefined, false);
        server = await MockHttpsServer.CreateMockHttpsServer();
        server.addRequestHandler('GET', `/${latestPath}`, 200, {
            "content-type": "application/text",
        }, latestVersion);

        server.addRequestHandler('GET', `/${invalidPath}`, 404);
        await server.start();
    });

    suite('The file to be downloaded exists', () => {
        test('Returns the latest version', async () => {
            let version = await getLatestOmniSharpVersion(`${server.baseUrl}/${latestPath}`, eventStream, networkSettingsProvider)
            expect(version).to.be.equal(latestVersion);
        });

        test('Expected events are created', async () => {
            let expectedEvents = [
                new LatestBuildDownloadStart(),
                new DownloadStart('Latest OmniSharp Version Information'),
                new DownloadSizeObtained(12),
                new DownloadProgress(100, 'Latest OmniSharp Version Information'),
                new DownloadSuccess(' Done!')
            ];
            await getLatestOmniSharpVersion(`${server.baseUrl}/${latestPath}`, eventStream, networkSettingsProvider)
            expect(eventBus.getEvents()).to.be.deep.equal(expectedEvents);
        });
    });

    suite('The file to be downloaded doesnot exist', () => {
        test('Throws error if the file doesnot exist', async () => {
            expect(getLatestOmniSharpVersion(`${server.baseUrl}/${invalidPath}`, eventStream, networkSettingsProvider)).to.be.rejected;
        });
    });

    teardown(async () => {
        await server.stop();
        eventBus.dispose();
    });
});