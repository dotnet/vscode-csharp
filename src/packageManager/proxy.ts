/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Url } from 'url';
import { HttpProxyAgent, HttpProxyAgentOptions } from 'http-proxy-agent';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import { Agent } from 'http';

function getSystemProxyURL(requestURL: Url): string | undefined {
    if (requestURL.protocol === 'http:') {
        return process.env.HTTP_PROXY ?? process.env.http_proxy;
    } else if (requestURL.protocol === 'https:') {
        return process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
    }

    return undefined;
}

export function getProxyAgent(requestURL: Url, proxy: string, strictSSL: boolean): Agent | undefined {
    const proxyURL = proxy.length > 0 ? proxy : getSystemProxyURL(requestURL);

    if (proxyURL === undefined || proxyURL.length === 0) {
        return undefined;
    }

    const proxyEndpoint = new URL(proxyURL);
    if (proxyEndpoint.protocol === null) {
        return undefined;
    }

    if (!/^https?:$/.test(proxyEndpoint.protocol)) {
        return undefined;
    }

    const opts: HttpProxyAgentOptions<string> & HttpsProxyAgentOptions<string> = {
        rejectUnauthorized: strictSSL,
    };

    return requestURL.protocol === 'http:'
        ? new HttpProxyAgent(proxyEndpoint, opts)
        : new HttpsProxyAgent(proxyEndpoint, opts);
}
