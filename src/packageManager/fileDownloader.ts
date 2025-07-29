/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as https from 'https';
import { EventStream } from '../eventStream';
import {
    DownloadSuccess,
    DownloadStart,
    DownloadFallBack,
    DownloadFailure,
    DownloadProgress,
    DownloadSizeObtained,
} from '../shared/loggingEvents';
import { NestedError } from '../nestedError';
import { parse as parseUrl } from 'url';
import { getProxyAgent } from './proxy';
import { NetworkSettingsProvider } from '../networkSettings';
import { CancellationToken } from 'vscode';

export async function DownloadFile(
    description: string,
    eventStream: EventStream,
    networkSettingsProvider: NetworkSettingsProvider,
    url: string,
    fallbackUrl?: string,
    token?: CancellationToken
): Promise<Buffer> {
    eventStream.post(new DownloadStart(description));

    try {
        const buffer = await downloadFile(description, url, eventStream, networkSettingsProvider, token);
        eventStream.post(new DownloadSuccess(` Done!`));
        return buffer;
    } catch (primaryUrlError) {
        // If the package has a fallback Url, and downloading from the primary Url failed, try again from
        // the fallback. This is used for debugger packages as some users have had issues downloading from
        // the CDN link
        if (fallbackUrl !== undefined) {
            eventStream.post(new DownloadFallBack(fallbackUrl));
            try {
                const buffer = await downloadFile(description, fallbackUrl, eventStream, networkSettingsProvider);
                eventStream.post(new DownloadSuccess(' Done!'));
                return buffer;
            } catch (_) {
                throw primaryUrlError;
            }
        } else {
            throw primaryUrlError;
        }
    }
}

async function downloadFile(
    description: string,
    urlString: string,
    eventStream: EventStream,
    networkSettingsProvider: NetworkSettingsProvider,
    token?: CancellationToken
): Promise<Buffer> {
    const url = parseUrl(urlString);
    const networkSettings = networkSettingsProvider();
    const proxy = networkSettings.proxy;
    const strictSSL = networkSettings.strictSSL;
    const options: https.RequestOptions = {
        host: url.hostname,
        path: url.path,
        agent: getProxyAgent(url, proxy, strictSSL),
        port: url.port,
        rejectUnauthorized: strictSSL,
    };

    const buffers: any[] = [];

    return new Promise<Buffer>((resolve, reject) => {
        token?.onCancellationRequested(() => {
            return reject(new NestedError(`Cancelled downloading ${urlString}.`));
        });

        const request = https.request(options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Redirect - download from new location
                if (response.headers.location === undefined) {
                    eventStream.post(
                        new DownloadFailure(`Failed to download from ${urlString}. Redirected without location header`)
                    );
                    return reject(new NestedError('Missing location'));
                }
                return resolve(
                    downloadFile(description, response.headers.location, eventStream, networkSettingsProvider, token)
                );
            } else if (response.statusCode !== 200) {
                // Download failed - print error message
                eventStream.post(
                    new DownloadFailure(`Failed to download from ${urlString}. Error code '${response.statusCode}')`)
                );
                return reject(new NestedError(response.statusCode!.toString())); // Known to exist because this is from a ClientRequest
            }

            if (response.headers['content-length'] === undefined) {
                eventStream.post(new DownloadFailure(`Failed to download from ${urlString}. No content-length header`));
                return reject(new NestedError('Missing content-length'));
            }

            // Downloading - hook up events
            const packageSize = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            let downloadPercentage = 0;

            eventStream.post(new DownloadSizeObtained(packageSize));

            response.on('data', (data) => {
                downloadedBytes += data.length;
                buffers.push(data);

                // Update status bar item with percentage
                const newPercentage = Math.ceil(100 * (downloadedBytes / packageSize));
                if (newPercentage !== downloadPercentage) {
                    downloadPercentage = newPercentage;
                    eventStream.post(new DownloadProgress(downloadPercentage, description));
                }
            });

            response.on('end', () => {
                resolve(Buffer.concat(buffers));
            });

            response.on('error', (err) => {
                reject(
                    new NestedError(
                        `Failed to download from ${urlString}. Error Message: ${err.message} || 'NONE'}`,
                        err
                    )
                );
            });
        });

        request.on('error', (err) => {
            reject(new NestedError(`Request error: ${err.message || 'NONE'}`, err));
        });

        // Execute the request
        request.end();
    });
}
