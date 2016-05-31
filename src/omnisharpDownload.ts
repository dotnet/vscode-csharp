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
import {OutputChannel} from 'vscode';

const decompress = require('decompress');

const BaseDownloadUrl = 'https://vscodeoscon.blob.core.windows.net/ext';
const DefaultInstallLocation = path.join(__dirname, '../.omnisharp');
const OmniSharpVersion = '1.9-beta4';

tmp.setGracefulCleanup();

function getOmnisharpAssetName(): string {
    switch (getSupportedPlatform()) {
        case SupportedPlatform.Windows:
            return `omnisharp-${OmniSharpVersion}-win-x64-net451.zip`;
        case SupportedPlatform.OSX:
            return `omnisharp-${OmniSharpVersion}-osx-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.CentOS:
            return `omnisharp-${OmniSharpVersion}-centos-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.Debian:
            return `omnisharp-${OmniSharpVersion}-debian-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.RHEL:
            return `omnisharp-${OmniSharpVersion}-rhel-x64-netcoreapp1.0.tar.gz`;
        case SupportedPlatform.Ubuntu:
            return `omnisharp-${OmniSharpVersion}-ubuntu-x64-netcoreapp1.0.tar.gz`;
            
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

export function downloadOmnisharp(output: OutputChannel): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        output.appendLine(`[INFO] Installing to ${DefaultInstallLocation}`);
        
        const assetName = getOmnisharpAssetName();
        const urlString = `${BaseDownloadUrl}/${assetName}`;
        
        output.appendLine(`[INFO] Attempting to download ${assetName}...`);

        return download(urlString)
            .then(inStream => {
                tmp.file((err, tmpPath, fd, cleanupCallback) => {
                    if (err) {
                        return reject(err);
                    }
                    
                    output.appendLine(`[INFO] Downloading to ${tmpPath}...`);
                    
                    const outStream = fs.createWriteStream(null, { fd: fd });
                    
                    outStream.once('error', err => reject(err));
                    inStream.once('error', err => reject(err));
                    
                    outStream.once('finish', () => {
                        // At this point, the asset has finished downloading.
                        
                        output.appendLine(`[INFO] Download complete!`);
                        output.appendLine(`[INFO] Decompressing...`);
                        
                        return decompress(tmpPath, DefaultInstallLocation)
                            .then(files => {
                                output.appendLine(`[INFO] Done! ${files.length} files unpacked.`)
                                return resolve(true);
                            })
                            .error(err => {
                                output.appendLine(`[ERROR] ${err}`);
                                return reject(err);
                            });
                    });
                    
                    inStream.pipe(outStream);
                });
            });
    });
}