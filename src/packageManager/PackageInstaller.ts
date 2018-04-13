/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as yauzl from 'yauzl';
import * as path from 'path';
import * as util from '../common';
import { EventStream } from "../EventStream";
import { InstallationProgress } from "../omnisharp/loggingEvents";
import { NestedError } from './packages';


export async function InstallPackage(fd: number, description: string, installPath: string, installTestPath: string, binaries: string[], eventStream: EventStream): Promise<void> {
    const installationStage = 'installPackages';

    //to do:  do not resolve the package binaries here
    resolvePackageBinaries(binaries, installPath);
    eventStream.post(new InstallationProgress(installationStage, description));

    return new Promise<void>((resolve, reject) => {
        //to do: there was a code to unlink the file here. look into that!!!!
        if (fd == 0) {
            return reject(new NestedError('Downloaded file unavailable'));
        }

        yauzl.fromFd(fd, { lazyEntries: true }, (err, zipFile) => {
            if (err) {
                return reject(new NestedError('Immediate zip file error', err));
            }

            zipFile.readEntry();

            zipFile.on('entry', (entry: yauzl.Entry) => {
                let absoluteEntryPath = path.resolve(getBaseInstallPath(installPath), entry.fileName);

                if (entry.fileName.endsWith('/')) {
                    // Directory - create it
                    mkdirp(absoluteEntryPath, { mode: 0o775 }, err => {
                        if (err) {
                            return reject(new NestedError('Error creating directory for zip directory entry:' + err.code || '', err));
                        }

                        zipFile.readEntry();
                    });
                }
                else {
                    // File - extract it
                    zipFile.openReadStream(entry, (err, readStream) => {
                        if (err) {
                            return reject(new NestedError('Error reading zip stream', err));
                        }

                        mkdirp(path.dirname(absoluteEntryPath), { mode: 0o775 }, err => {
                            if (err) {
                                return reject({ message: "", error: err });
                                //new PackageError('Error creating directory for zip file entry', pkg, err));
                            }

                            // Make sure executable files have correct permissions when extracted
                            let fileMode = binaries && binaries.indexOf(absoluteEntryPath) !== -1
                                ? 0o755
                                : 0o664;

                            readStream.pipe(fs.createWriteStream(absoluteEntryPath, { mode: fileMode }));
                            readStream.on('end', () => zipFile.readEntry());
                        });
                    });
                }
            });

            zipFile.on('end', () => {
                resolve();
            });

            zipFile.on('error', err => {
                reject(new NestedError('Zip File Error:' + err.code || '', err));
            });
        });
    });
}

//to do: remove these functions from here into a separate component
function resolvePackageBinaries(binaries: string[], installPath: string) {
    // Convert relative binary paths to absolute
    if (binaries) {
        binaries = binaries.map(value => path.resolve(getBaseInstallPath(installPath), value));
    }
}

export function getBaseInstallPath(installPath: string): string {
    let basePath = util.getExtensionPath();
    if (installPath) {
        basePath = path.join(basePath, installPath);
    }

    return basePath;
}
