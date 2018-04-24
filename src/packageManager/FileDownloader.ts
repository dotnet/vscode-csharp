/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as https from 'https';
import * as util from '../common';
import * as fs from 'fs';
import { EventStream } from "../EventStream";
import { DownloadSuccess, DownloadStart, DownloadFallBack, DownloadFailure, DownloadProgress, DownloadSizeObtained } from "../omnisharp/loggingEvents";
import { NestedError } from "../NestedError";
import { parse as parseUrl } from 'url';
import { getProxyAgent } from './proxy';
import { NetworkSettingsProvider } from '../NetworkSettings';

export async function DownloadFile(destinationFileDescriptor: number, description: string, eventStream: EventStream, networkSettingsProvider: NetworkSettingsProvider, url: string, fallbackUrl?: string){
    eventStream.post(new DownloadStart(description));
    
    try {
        await downloadFile(destinationFileDescriptor, description, url, eventStream, networkSettingsProvider);
        eventStream.post(new DownloadSuccess(` Done!`));
    }
    catch (primaryUrlError) {
        // If the package has a fallback Url, and downloading from the primary Url failed, try again from 
        // the fallback. This is used for debugger packages as some users have had issues downloading from
        // the CDN link
        if (fallbackUrl) {
            eventStream.post(new DownloadFallBack(fallbackUrl));
            try {
                await downloadFile(destinationFileDescriptor, description, fallbackUrl, eventStream, networkSettingsProvider);
                eventStream.post(new DownloadSuccess(' Done!'));
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

async function downloadFile(fd: number, description: string, urlString: string, eventStream: EventStream, networkSettingsProvider: NetworkSettingsProvider): Promise<void> {
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

    return new Promise<void>((resolve, reject) => {
        if (fd == 0) {
            reject(new NestedError("Temporary package file unavailable"));
        }

        let request = https.request(options, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Redirect - download from new location
                return resolve(downloadFile(fd, description, response.headers.location, eventStream, networkSettingsProvider));
            }

            else if (response.statusCode != 200) {
                // Download failed - print error message
                eventStream.post(new DownloadFailure(`failed (error code '${response.statusCode}')`));
                return reject(new NestedError(response.statusCode.toString()));
            }

            // Downloading - hook up events
            let packageSize = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            let downloadPercentage = 0;
            let tmpFile = fs.createWriteStream(null, { fd });

            eventStream.post(new DownloadSizeObtained(packageSize));

            response.on('data', data => {
                downloadedBytes += data.length;

                // Update status bar item with percentage
                let newPercentage = Math.ceil(100 * (downloadedBytes / packageSize));
                if (newPercentage !== downloadPercentage) {
                    downloadPercentage = newPercentage;
                    eventStream.post(new DownloadProgress(downloadPercentage, description));
                }
            });

            response.on('end', () => {
                resolve();
            });

            response.on('error', err => {
                reject(new NestedError(`Reponse error: ${err.message || 'NONE'}`, err));
            });

            // Begin piping data from the response to the package file
            response.pipe(tmpFile, { end: false });
        });

        request.on('error', err => {
            reject(new NestedError(`Request error: ${err.message || 'NONE'}`, err));
        });

        // Execute the request
        request.end();
    });
}