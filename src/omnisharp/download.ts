/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
 
 /*
 * Note that this file intentionally does not import 'vscode' as the code within is intended
 * to be usable outside of VS Code. 
 */

'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as https from 'https';
import * as stream from 'stream';
import * as tmp from 'tmp';
import {parse} from 'url';
import {Flavor, getInstallDirectory} from './omnisharp';
import {Platform} from '../platform';
import {getProxyAgent} from '../proxy';
import {Logger} from './logger';

const decompress = require('decompress');

const BaseDownloadUrl = 'https://omnisharpdownload.blob.core.windows.net/ext';
const OmniSharpVersion = '1.9-beta16';

tmp.setGracefulCleanup();

function getDownloadFileName(flavor: Flavor, platform: Platform): string {
    let fileName = `omnisharp-${OmniSharpVersion}-`;

    if (flavor === Flavor.CoreCLR) {
        switch (platform) {
            case Platform.Windows:
                fileName += 'win-x64-netcoreapp1.0.zip';
                break;
            case Platform.OSX:
                fileName += 'osx-x64-netcoreapp1.0.tar.gz';
                break;
            case Platform.CentOS:
                fileName += 'centos-x64-netcoreapp1.0.tar.gz';
                break;
            case Platform.Debian:
                fileName += 'debian-x64-netcoreapp1.0.tar.gz';
                break;
            case Platform.Fedora:
                fileName += 'fedora-x64-netcoreapp1.0.tar.gz';
                break;
            case Platform.OpenSUSE:
                fileName += 'opensuse-x64-netcoreapp1.0.tar.gz';
                break;
            case Platform.RHEL:
                fileName += 'rhel-x64-netcoreapp1.0.tar.gz';
                break;
            case Platform.Ubuntu14:
                fileName += 'ubuntu14-x64-netcoreapp1.0.tar.gz';
                break;
            case Platform.Ubuntu16:
                fileName += 'ubuntu16-x64-netcoreapp1.0.tar.gz';
                break;
   
            default:
                if (process.platform === 'linux') {
                    throw new Error(`Unsupported linux distribution`);
                }
                else {
                    throw new Error(`Unsupported platform: ${process.platform}`);
                }
        }
    }
    else if (flavor === Flavor.Desktop) {
        fileName += 'win-x64-net451.zip';
    }
    else if (flavor === Flavor.Mono) {
        fileName += 'mono.tar.gz';
    }
    else {
        throw new Error(`Unexpected OmniSharp flavor specified: ${flavor}`);
    }

    return fileName;
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

export function go(flavor: Flavor, platform: Platform, logger: Logger, proxy?: string, strictSSL?: boolean) {
    return new Promise<boolean>((resolve, reject) => {
        const fileName = getDownloadFileName(flavor, platform);
        const installDirectory = getInstallDirectory(flavor);

        logger.appendLine(`Installing OmniSharp to ${installDirectory}`);
        logger.increaseIndent();

        const urlString = `${BaseDownloadUrl}/${fileName}`;

        logger.appendLine(`Attempting to download ${fileName}`);

        return download(urlString, proxy, strictSSL)
            .then(inStream => {
                tmp.file((err, tmpPath, fd, cleanupCallback) => {
                    if (err) {
                        return reject(err);
                    }
                    
                    logger.appendLine(`Downloading to ${tmpPath}...`);
                    
                    const outStream = fs.createWriteStream(null, { fd: fd });
                    
                    outStream.once('error', err => reject(err));
                    inStream.once('error', err => reject(err));
                    
                    outStream.once('finish', () => {
                        // At this point, the asset has finished downloading.
                        
                        logger.appendLine(`Download complete!`);
                        logger.appendLine(`Decompressing...`);
                        
                        return decompress(tmpPath, installDirectory)
                            .then(files => {
                                logger.appendLine(`Done! ${files.length} files unpacked.\n`);
                                return resolve(true);
                            })
                            .catch(err => {
                                logger.appendLine(`[ERROR] ${err}`);
                                return reject(err);
                            });
                    });
                    
                    inStream.pipe(outStream);
                });
            })
            .catch(err =>
            {
                logger.appendLine(`[ERROR] ${err}`);
            });
    }).then(res => {
        logger.decreaseIndent();
        return res;
    });
}