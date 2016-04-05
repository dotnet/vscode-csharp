/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
 
'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as tmp from 'tmp';

const Decompress = require('decompress');
const Github = require('github-releases');

const OmnisharpRepo = 'OmniSharp/omnisharp-roslyn';
const OmnisharpVersion = 'v1.9-alpha10';
const DefaultInstallLocation = path.join(__dirname, '../.omnisharp');

tmp.setGracefulCleanup();

function getOmnisharpAssetName(): string {
    switch (process.platform) {
        case 'win32':
            return 'omnisharp-win-x64-net451.zip';
        case 'darwin':
            return 'omnisharp-osx-x64-netcoreapp1.0.tar.gz';
        case 'linux':
            return 'omnisharp-linux-x64-netcoreapp1.0.tar.gz';
        default:
            throw new Error(`Unsupported platform: ${process.platform}`);
    }
}

export function downloadOmnisharp(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        console.log(`[OmniSharp]: Installing to ${DefaultInstallLocation}`);
        
        const repo = new Github({ repo: OmnisharpRepo, token: null });
        const assetName = getOmnisharpAssetName();
        
        console.log(`[OmniSharp] Looking for ${OmnisharpVersion}, ${assetName}...`);
        
        repo.getReleases({ tag_name: OmnisharpVersion }, (err, releases) => {
            if (err) {
                return reject(err);
            }
            
            if (!releases.length) {
                return reject(new Error(`OmniSharp release ${OmnisharpVersion} not found.`));
            }
            
            // Note: there should only be a single release, but use the first one
            // if there are ever multiple results. Same thing for assets.
            let foundAsset = null;
            
            for (var asset of releases[0].assets) {
                if (asset.name === assetName) {
                    foundAsset = asset;
                    break;
                }
            }
            
            if (!foundAsset) {
                return reject(new Error(`OmniSharp release ${OmnisharpVersion} asset, ${assetName} not found.`));
            }
            
            console.log(`[OmniSharp] Found it!`);
            
            repo.downloadAsset(foundAsset, (err, inStream) => {
                if (err) {
                    return reject(err);
                }
                
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
                            
                        if (path.extname(foundAsset.name).toLowerCase() === '.zip') {
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
    });
}