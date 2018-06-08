/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getLatestOmniSharpVersion } from "../../src/omnisharp/GetLatestOmniSharpVersion";
import MockHttpsServer from "./testAssets/MockHttpsServer";
import { EventStream } from "../../src/EventStream";
import NetworkSettings, { NetworkSettingsProvider } from "../../src/NetworkSettings";
import { expect } from 'chai';

suite(getLatestOmniSharpVersion.name, () => {
    let server: MockHttpsServer;
    let eventStream: EventStream;
    let networkSettingsProvider: NetworkSettingsProvider;
    const latestVersion = "some version";
    const latestPath = "somePath";

    setup(async () => {
        eventStream = new EventStream();
        networkSettingsProvider = () => new NetworkSettings(undefined, false);
        server = await MockHttpsServer.CreateMockHttpsServer();
        server.addRequestHandler('GET', `/${latestPath}`, 200, {
            "content-type": "application/text",
        }, latestVersion);
        await server.start();
    });

    test('Returns the latest version', async () => {
        let version = await getLatestOmniSharpVersion(`${server.baseUrl}/${latestPath}`, eventStream, networkSettingsProvider)
        expect(version).to.be.equal(latestVersion);
    });

    teardown(async ()=>{
        await server.stop();
    });
});