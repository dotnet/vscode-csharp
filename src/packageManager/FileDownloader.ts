/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as https from 'https';
import * as util from '../common';
import { EventStream } from "../EventStream";
import { DownloadSuccess, DownloadStart, DownloadFallBack, DownloadFailure, DownloadProgress, DownloadSizeObtained } from "../omnisharp/loggingEvents";
import { NestedError } from "../NestedError";
import { parse as parseUrl } from 'url';
import { getProxyAgent } from './proxy';
import { NetworkSettingsProvider } from '../NetworkSettings';

export async function DownloadFile(description: string, eventStream: EventStream, networkSettingsProvider: NetworkSettingsProvider, url: string, fallbackUrl?: string): Promise<Buffer> {
    eventStream.post(new DownloadStart(description));

    try {
        let buffer = await downloadFile(description, url, eventStream, networkSettingsProvider);
        eventStream.post(new DownloadSuccess(` Done!`));
        return buffer;
    }
    catch (primaryUrlError) {
        // If the package has a fallback Url, and downloading from the primary Url failed, try again from
        // the fallback. This is used for debugger packages as some users have had issues downloading from
        // the CDN link
        if (fallbackUrl) {
            eventStream.post(new DownloadFallBack(fallbackUrl));
            try {
                let buffer = await downloadFile(description, fallbackUrl, eventStream, networkSettingsProvider);
                eventStream.post(new DownloadSuccess(' Done!'));
                return buffer;
            }
            catch (fallbackUrlError) {
                throw primaryUrlError;
            }
        }
        else {
            throw primaryUrlError;
        }
    }
}

async function downloadFile(description: string, urlString: string, eventStream: EventStream, networkSettingsProvider: NetworkSettingsProvider): Promise<Buffer> {
    const url = parseUrl(urlString);
    const networkSettings = networkSettingsProvider();
    const proxy = networkSettings.proxy;
    const strictSSL = networkSettings.strictSSL;
    const options: https.RequestOptions = {
        host: url.hostname,
        path: url.path,
        agent: getProxyAgent(url, proxy, strictSSL),
        port: url.port,
        rejectUnauthorized: util.isBoolean(strictSSL) ? strictSSL : true
    };

    let buffers: any[] = [];

    return new Promise<Buffer>((resolve, reject) => {
        let request = https.request(options, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Redirect - download from new location
                return resolve(downloadFile(description, response.headers.location, eventStream, networkSettingsProvider));
            }

            else if (response.statusCode != 200) {
                // Download failed - print error message
                eventStream.post(new DownloadFailure(`Failed to download from ${urlString}. Error code '${response.statusCode}')`));
                return reject(new NestedError(response.statusCode.toString()));
            }

            // Downloading - hook up events
            let packageSize = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            let downloadPercentage = 0;

            eventStream.post(new DownloadSizeObtained(packageSize));

            response.on('data', data => {
                downloadedBytes += data.length;
                buffers.push(data);

                // Update status bar item with percentage
                let newPercentage = Math.ceil(100 * (downloadedBytes / packageSize));
                if (newPercentage !== downloadPercentage) {
                    downloadPercentage = newPercentage;
                    eventStream.post(new DownloadProgress(downloadPercentage, description));
                }
            });

            response.on('end', () => {
                resolve(Buffer.concat(buffers));
            });

            response.on('error', err => {
                reject(new NestedError(`Failed to download from ${urlString}. Error Message: ${err.message} || 'NONE'}`, err));
            });
        });

        request.on('error', err => {
            reject(new NestedError(`Request error: ${err.message || 'NONE'}`, err));
        });

        // Execute the request
        request.end();
    });
}