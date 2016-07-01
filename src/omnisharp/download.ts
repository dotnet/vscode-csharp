/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
 
'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as https from 'https';
import * as stream from 'stream';
import * as tmp from 'tmp';
import {parse} from 'url';
import {SupportedPlatform, getSupportedPlatform} from '../utils';
import {getProxyAgent} from '../proxy';

const decompress = require('decompress');

const BaseDownloadUrl = 'https://omnisharpdownload.blob.core.windows.net/ext';
const DefaultInstallLocation = path.join(__dirname, '../.omnisharp');
export const OmniSharpVersion = '1.9-beta11';

tmp.setGracefulCleanup();

export function getOmnisharpAssetName(): string {
    switch (getSupportedPlatform()) {
        case SupportedPlatform.Windows:
            return `omnisharp-${OmniSharpVersion}-win-x64-net451.zip`;
        case SupportedPlatform.OSX:
            return `omnisharp-${OmniSharpVersion}-osx-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.CentOS:
            return `omnisharp-${OmniSharpVersion}-centos-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.Debian:
            return `omnisharp-${OmniSharpVersion}-debian-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.Fedora:
            return `omnisharp-${OmniSharpVersion}-fedora-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.OpenSUSE:
            return `omnisharp-${OmniSharpVersion}-opensuse-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.RHEL:
            return `omnisharp-${OmniSharpVersion}-rhel-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.Ubuntu14:
            return `omnisharp-${OmniSharpVersion}-ubuntu14-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.Ubuntu16:
            return `omnisharp-${OmniSharpVersion}-ubuntu16-x64-netcoreapp1.0.tar.gz`;
            
        default:
            if (process.platform === 'linux') {
                throw new Error(`Unsupported linux distribution`);
            }
            else {
                throw new Error(`Unsupported platform: ${process.platform}`);
            }
    }
}

function download(urlString: string, proxy?: string, strictSSL?: boolean): Promise<stream.Readable> {
    let url = parse(urlString);
    
    const agent = getProxyAgent(url, proxy, strictSSL);
    
    let options: https.RequestOptions = {
        host: url.host,
        path: url.path,
        agent: agent
    };
    
    return new Promise<stream.Readable>((resolve, reject) => {
        return https.get(options, res => {
            // handle redirection
            if (res.statusCode === 302) {
                return download(res.headers.location);
            }
            else if (res.statusCode !== 200) {
                return reject(Error(`Download failed with code ${res.statusCode}.`));
            }
            
            return resolve(res);
        });
    });
}

export function downloadOmnisharp(log: (message: string) => void, omnisharpAssetName?: string, proxy?: string, strictSSL?: boolean) {
    return new Promise<boolean>((resolve, reject) => {
        log(`[INFO] Installing to ${DefaultInstallLocation}`);

        const assetName = omnisharpAssetName || getOmnisharpAssetName();
        const urlString = `${BaseDownloadUrl}/${assetName}`;

        log(`[INFO] Attempting to download ${assetName}...`);

        return download(urlString, proxy, strictSSL)
            .then(inStream => {
                tmp.file((err, tmpPath, fd, cleanupCallback) => {
                    if (err) {
                        return reject(err);
                    }
                    
                    log(`[INFO] Downloading to ${tmpPath}...`);
                    
                    const outStream = fs.createWriteStream(null, { fd: fd });
                    
                    outStream.once('error', err => reject(err));
                    inStream.once('error', err => reject(err));
                    
                    outStream.once('finish', () => {
                        // At this point, the asset has finished downloading.
                        
                        log(`[INFO] Download complete!`);
                        log(`[INFO] Decompressing...`);
                        
                        return decompress(tmpPath, DefaultInstallLocation)
                            .then(files => {
                                log(`[INFO] Done! ${files.length} files unpacked.`);
                                return resolve(true);
                            })
                            .catch(err => {
                                log(`[ERROR] ${err}`);
                                return reject(err);
                            });
                    });
                    
                    inStream.pipe(outStream);
                });
            })
            .catch(err =>
            {
                log(`[ERROR] ${err}`);
            });
    });
}