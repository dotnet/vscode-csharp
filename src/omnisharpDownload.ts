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
import {SupportedPlatform, getSupportedPlatform} from './utils';
import {getProxyAgent} from './proxy';

const Decompress = require('decompress');

const BaseDownloadUrl = 'https://vscodeoscon.blob.core.windows.net/ext';
const DefaultInstallLocation = path.join(__dirname, '../.omnisharp');
const ApiToken = '18a6f5ecea711220d4f433d4fd41062d479fda1d';

tmp.setGracefulCleanup();

function getOmnisharpAssetName(): string {
    switch (getSupportedPlatform()) {
        case SupportedPlatform.Windows:
            return 'omnisharp-win-x64-net451.zip';
        case SupportedPlatform.OSX:
            return 'omnisharp-osx-x64-netcoreapp1.0.tar.gz';
        case SupportedPlatform.CentOS:
            return 'omnisharp-centos-x64-netcoreapp1.0.tar.gz';
        case SupportedPlatform.Debian:
            return 'omnisharp-debian-x64-netcoreapp1.0.tar.gz';
        case SupportedPlatform.RHEL:
            return 'omnisharp-rhel-x64-netcoreapp1.0.tar.gz';
        case SupportedPlatform.Ubuntu:
            return 'omnisharp-ubuntu-x64-netcoreapp1.0.tar.gz';
            
        default:
            if (process.platform === 'linux') {
                throw new Error(`Unsupported linux distribution`);
            }
            else {
                throw new Error(`Unsupported platform: ${process.platform}`);
            }
    }
}

function download(urlString: string): Promise<stream.Readable> {
    let url = parse(urlString);
    
    const agent = getProxyAgent(url);
    
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

export function downloadOmnisharp(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        console.log(`[OmniSharp]: Installing to ${DefaultInstallLocation}`);
        
        const assetName = getOmnisharpAssetName();
        const urlString = `${BaseDownloadUrl}/${assetName}`;
        
        console.log(`[OmniSharp] Attempting to download ${assetName}...`);

        return download(urlString)
            .then(inStream => {
                tmp.file((err, tmpPath, fd, cleanupCallback) => {
                    if (err) {
                        return reject(err);
                    }
                    
                    console.log(`[OmniSharp] Downloading to ${tmpPath}...`);
                    
                    const outStream = fs.createWriteStream(null, { fd: fd });
                    
                    outStream.once('error', err => reject(err));
                    inStream.once('error', err => reject(err));
                    
                    outStream.once('finish', () => {
                        // At this point, the asset has finished downloading.
                        
                        console.log(`[OmniSharp] Download complete!`);
                        
                        let decompress = new Decompress()
                            .src(tmpPath)
                            .dest(DefaultInstallLocation);
                            
                        if (path.extname(assetName).toLowerCase() === '.zip') {
                            decompress = decompress.use(Decompress.zip());
                            console.log(`[OmniSharp] Unzipping...`);
                        }
                        else {
                            decompress = decompress.use(Decompress.targz());
                            console.log(`[OmniSharp] Untaring...`);
                        }

                        decompress.run((err, files) => {
                            if (err) {
                                return reject(err);
                            }
                            
                            console.log(`[OmniSharp] Done! ${files.length} files unpacked.`)
                            
                            return resolve(true);
                        });
                    });
                    
                    inStream.pipe(outStream);
                });
            });
    });
}