/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxyAgent } from '../../../../src/packageManager/proxy.ts';
import url from 'url';

describe(`${getProxyAgent.name}`, () => {
    let originalHttpProxy: string | undefined;
    let originalHttpsProxy: string | undefined;

    const requestUrl = url.parse('https://github.com');

    beforeAll(() => {
        originalHttpProxy = process.env.HTTP_PROXY;
        originalHttpsProxy = process.env.HTTPS_PROXY;
    });

    afterAll(() => {
        if (originalHttpProxy !== undefined) {
            process.env.HTTP_PROXY = originalHttpProxy;
        } else {
            delete process.env.HTTP_PROXY;
        }

        if (originalHttpsProxy !== undefined) {
            process.env.HTTPS_PROXY = originalHttpsProxy;
        } else {
            delete process.env.HTTPS_PROXY;
        }
    });

    beforeEach(() => {
        delete process.env.HTTP_PROXY;
        delete process.env.HTTPS_PROXY;
    });

    test('Returns `undefined` for empty proxy url and `undefined` HTTP_PROXY env', async () => {
        const result = getProxyAgent(requestUrl, /* proxy */ '', /* strictSSL */ false);
        expect(result).toBe(undefined);
    });

    test('Returns `undefined` for empty proxy url and empty HTTP_PROXY env', async () => {
        process.env.HTTP_PROXY = '';
        process.env.HTTPS_PROXY = '';

        const result = getProxyAgent(requestUrl, /* proxy */ '', /* strictSSL */ false);
        expect(result).toBe(undefined);
    });

    test('Returns an HTTP proxy agent for HTTP requests', () => {
        const result = getProxyAgent(url.parse('http://github.com'), 'http://localhost:8080', true);

        expect(result).toBeInstanceOf(HttpProxyAgent);
    });

    test('Returns an HTTPS proxy agent for HTTPS requests', () => {
        const result = getProxyAgent(requestUrl, 'http://localhost:8080', true);

        expect(result).toBeInstanceOf(HttpsProxyAgent);
    });
});
