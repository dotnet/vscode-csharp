/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as tmp from 'tmp';
import * as https from 'https';
import * as util from '../common';
import * as fs from 'fs';
import { EventStream } from "../EventStream";
import { DownloadSuccess, DownloadStart, DownloadFallBack, DownloadFailure, DownloadProgress, DownloadSizeObtained } from "../omnisharp/loggingEvents";
import { Package, PackageError } from "./packages";
import { parse as parseUrl } from 'url';
import { getProxyAgent } from './proxy';
import { vscode } from '../vscodeAdapter';

export class PackageDownloader {
    constructor() {
        // Ensure our temp files get cleaned up in case of error.
        tmp.setGracefulCleanup();
    }

    public async DownloadPackage(description: string, url: string, fallbackUrl: string, vscode: vscode, eventStream: EventStream) {
        const config = vscode.workspace.getConfiguration();
        const proxy = config.get<string>('http.proxy');
        const strictSSL = config.get('http.proxyStrictSSL', true);
        return downloadPackage(pkg, eventStream, proxy, strictSSL);
    }
}

// We dont need this as we are already doing this check in the package manager
/*async function maybeDownloadPackage(pkg: Package, eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<Package> {
    let exists = await doesPackageTestPathExist(pkg);
    if (!exists) {
        return downloadPackage(pkg, eventStream, proxy, strictSSL);
    } else {
        eventStream.post(new DownloadSuccess(`Skipping package '${pkg.description}' (already downloaded).`));
        return pkg;
    }
}*/

async function downloadPackage(description: string, url: string, fallbackUrl: string, eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<Package> {
    eventStream.post(new DownloadStart(description));
    const tmpResult = await new Promise<tmp.SynchrounousResult>((resolve, reject) => {
        tmp.file({ prefix: 'package-' }, (err, path, fd, cleanupCallback) => {
            if (err) {
                return reject(new PackageError('Error from tmp.file', description, err));
            }

            resolve(<tmp.SynchrounousResult>{ name: path, fd: fd, removeCallback: cleanupCallback });
        });
    });

    try {
        await downloadFile(tmpResult, description,url, eventStream, proxy, strictSSL);
        eventStream.post(new DownloadSuccess(` Done!`));
    }
    catch (primaryUrlError) {
        // If the package has a fallback Url, and downloading from the primary Url failed, try again from 
        // the fallback. This is used for debugger packages as some users have had issues downloading from
        // the CDN link
        if (fallbackUrl) {
            eventStream.post(new DownloadFallBack(fallbackUrl));
            try {
                await downloadFile(tmpFile, description, fallbackUrl, eventStream, proxy, strictSSL);
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

async function downloadFile(tmpFile: tmp.SynchrounousResult, description: string, urlString: string, eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<void> {
    const url = parseUrl(urlString);

    const options: https.RequestOptions = {
        host: url.hostname,
        path: url.path,
        agent: getProxyAgent(url, proxy, strictSSL),
        port: url.port,
        rejectUnauthorized: util.isBoolean(strictSSL) ? strictSSL : true
    };

    return new Promise<void>((resolve, reject) => {
        if (!tmpFile || tmpFile.fd == 0) {
            return reject(new PackageError("Temporary package file unavailable", pkg));
        }

        let request = https.request(options, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Redirect - download from new location
                return resolve(downloadFile(tmpFile, description, response.headers.location, eventStream, proxy, strictSSL));
            }

            if (response.statusCode != 200) {
                // Download failed - print error message
                eventStream.post(new DownloadFailure(`failed (error code '${response.statusCode}')`));
                return reject(new PackageError(response.statusCode.toString(), description));
            }

            // Downloading - hook up events
            let packageSize = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            let downloadPercentage = 0;
            let tmpFile = fs.createWriteStream(null, { fd: tmpFile.fd });

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
                reject(new PackageError(`Reponse error: ${err.message || 'NONE'}`, description, err));
            });

            // Begin piping data from the response to the package file
            response.pipe(tmpFile, { end: false });
        });

        request.on('error', err => {
            console.log(err);
            reject(new PackageError(`Request error: ${err.message || 'NONE'}`, description, err));
        });

        // Execute the request
        request.end();
    });
}