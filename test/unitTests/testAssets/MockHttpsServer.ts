/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as fs from 'async-file';
import * as getPort from 'get-port';

// There are no typings for this library.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ServerMock = require("mock-http-server");

export default class MockHttpsServer {

    constructor(private server: any, public readonly baseUrl: string) {
    }

    public addRequestHandler(method: string, path: string, reply_status: number, reply_headers?: any, reply_body?: any) {
        this.server.on({
            method,
            path,
            reply: {
                status: reply_status,
                headers: reply_headers,
                body: reply_body
            }
        });
    }

    public async start() {
        return new Promise(resolve => this.server.start(resolve));
    }

    public async stop() {
        return new Promise((resolve, _) => this.server.stop(resolve));
    }

    public static async CreateMockHttpsServer(): Promise<MockHttpsServer> {
        const port = await getPort();
        const server = new ServerMock(null,
            {
                host: "localhost",
                port: port,
                key: await fs.readFile("test/unitTests/testAssets/private.pem"),
                cert: await fs.readFile("test/unitTests/testAssets/public.pem")
            });

        return new MockHttpsServer(server, `https://localhost:${port}`);
    }
}

