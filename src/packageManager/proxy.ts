/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Url, parse as parseUrl } from 'url';
import HttpProxyAgent = require('http-proxy-agent');
import HttpsProxyAgent = require('https-proxy-agent');
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

    if (proxyURL === undefined) {
        return undefined;
    }

    const proxyEndpoint = parseUrl(proxyURL);
    if (proxyEndpoint.protocol === undefined) {
        return undefined;
    }

    if (!/^https?:$/.test(proxyEndpoint.protocol)) {
        return undefined;
    }

    const opts: HttpProxyAgent.HttpProxyAgentOptions & HttpsProxyAgent.HttpsProxyAgentOptions = {
        host: proxyEndpoint.hostname,
        port: proxyEndpoint.port,
        auth: proxyEndpoint.auth,
        rejectUnauthorized: strictSSL,
    };

    return requestURL.protocol === 'http:' ? HttpProxyAgent(opts) : HttpsProxyAgent(opts);
}
