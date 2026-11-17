/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readFile } from 'fs/promises';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as path from 'path';

interface MockResponse {
    status: number;
    headers?: Record<string, string | number>;
    body?: string | Buffer;
}

export default class MockHttpsServer {
    private readonly handlers = new Map<string, MockResponse>();

    private constructor(
        private readonly server: https.Server,
        public readonly baseUrl: string
    ) {
        server.on('request', (request, response) => {
            const handler = this.handlers.get(MockHttpsServer.getKey(request.method ?? '', request.url ?? ''));
            if (!handler) {
                response.writeHead(404).end();
                return;
            }

            const headers: Record<string, string | number> = { ...handler.headers };
            if (handler.body !== undefined && !hasHeader(headers, 'content-length')) {
                headers['content-length'] = Buffer.byteLength(handler.body);
            }

            response.writeHead(handler.status, headers);
            response.end(handler.body);
        });
    }

    public addRequestHandler(
        method: string,
        urlPath: string,
        status: number,
        headers?: Record<string, string | number>,
        body?: string | Buffer
    ) {
        this.handlers.set(MockHttpsServer.getKey(method, urlPath), { status, headers, body });
    }

    public async stop(): Promise<void> {
        // Drop keep-alive sockets so close() doesn't wait for them to time out.
        this.server.closeAllConnections();
        return new Promise((resolve, reject) => this.server.close((error) => (error ? reject(error) : resolve())));
    }

    /**
     * Creates an HTTPS server listening on an available loopback port, so baseUrl is usable immediately.
     */
    public static async CreateMockHttpsServer(): Promise<MockHttpsServer> {
        const server = https.createServer({
            key: await readFile(path.join(__dirname, 'private.pem')),
            cert: await readFile(path.join(__dirname, 'public.pem')),
        });

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => {
                server.off('error', reject);
                resolve();
            });
        });

        const { port } = server.address() as AddressInfo;
        return new MockHttpsServer(server, `https://127.0.0.1:${port}`);
    }

    private static getKey(method: string, urlPath: string): string {
        return `${method.toUpperCase()} ${urlPath}`;
    }
}

function hasHeader(headers: Record<string, string | number>, name: string): boolean {
    return Object.keys(headers).some((key) => key.toLowerCase() === name);
}
