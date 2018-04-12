/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Package, PackageError, getPackageTestPath, getBaseInstallPath } from "./packages";
import { EventStream } from "../EventStream";
import { InstallationProgress } from "../omnisharp/loggingEvents";
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as yauzl from 'yauzl';
import * as path from 'path';

export class PackageInstaller {
    constructor() { }

    public InstallPackage(pkg: Package, eventStream: EventStream): Promise<void> {
        const installationStage = 'installPackages';
        if (!pkg.tmpFile) {
            // Download of this package was skipped, so there is nothing to install
            return Promise.resolve();
        }

        resolvePackageBinaries(pkg);
        eventStream.post(new InstallationProgress(installationStage, pkg.description));

        return new Promise<void>((resolve, baseReject) => {
            const reject = (err: any) => {
                // If anything goes wrong with unzip, make sure we delete the test path (if there is one)
                // so we will retry again later
                const testPath = getPackageTestPath(pkg);
                if (testPath) {
                    fs.unlink(testPath, unlinkErr => {
                        baseReject(err);
                    });
                } else {
                    baseReject(err);
                }
            };

            if (pkg.tmpFile.fd == 0) {
                return reject(new PackageError('Downloaded file unavailable', pkg));
            }

            yauzl.fromFd(pkg.tmpFile.fd, { lazyEntries: true }, (err, zipFile) => {
                if (err) {
                    return reject(new PackageError('Immediate zip file error', pkg, err));
                }

                zipFile.readEntry();

                zipFile.on('entry', (entry: yauzl.Entry) => {
                    let absoluteEntryPath = path.resolve(getBaseInstallPath(pkg), entry.fileName);

                    if (entry.fileName.endsWith('/')) {
                        // Directory - create it
                        mkdirp(absoluteEntryPath, { mode: 0o775 }, err => {
                            if (err) {
                                return reject(new PackageError('Error creating directory for zip directory entry:' + err.code || '', pkg, err));
                            }

                            zipFile.readEntry();
                        });
                    }
                    else {
                        // File - extract it
                        zipFile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                return reject(new PackageError('Error reading zip stream', pkg, err));
                            }

                            mkdirp(path.dirname(absoluteEntryPath), { mode: 0o775 }, err => {
                                if (err) {
                                    return reject(new PackageError('Error creating directory for zip file entry', pkg, err));
                                }

                                // Make sure executable files have correct permissions when extracted
                                let fileMode = pkg.binaries && pkg.binaries.indexOf(absoluteEntryPath) !== -1
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
                    reject(new PackageError('Zip File Error:' + err.code || '', pkg, err));
                });
            });
        }).then(() => {
            // Clean up temp file
            pkg.tmpFile.removeCallback();
        });
    }
}

function resolvePackageBinaries(pkg: Package) {
    // Convert relative binary paths to absolute
    if (pkg.binaries) {
        pkg.binaries = pkg.binaries.map(value => path.resolve(getBaseInstallPath(pkg), value));
    }
}