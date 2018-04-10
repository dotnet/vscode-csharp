/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as https from 'https';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as tmp from 'tmp';
import { parse as parseUrl } from 'url';
import * as yauzl from 'yauzl';
import * as util from './common';
import { PlatformInformation } from './platform';
import { getProxyAgent } from './proxy';
import { DownloadSuccess, DownloadStart, DownloadFailure, DownloadProgress, InstallationProgress, DownloadFallBack, DownloadSizeObtained } from './omnisharp/loggingEvents';
import { EventStream } from './EventStream';

export interface Package {
    description: string;
    url: string;
    fallbackUrl?: string;
    installPath?: string;
    platforms: string[];
    architectures: string[];
    binaries: string[];
    tmpFile: tmp.SynchrounousResult;
    platformId?: string;

    // Path to use to test if the package has already been installed
    installTestPath?: string;
}

export class PackageError extends Error {
    // Do not put PII (personally identifiable information) in the 'message' field as it will be logged to telemetry
    constructor(public message: string,
        public pkg: Package = null,
        public innerError: any = null) {
        super(message);
    }
}

export class PackageManager {
    private allPackages: Package[];

    public constructor(
        private platformInfo: PlatformInformation) {

        // Ensure our temp files get cleaned up in case of error.
        tmp.setGracefulCleanup();
    }

    public async DownloadPackages(eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<void> {
        let packages = await this.GetPackages();
        return util.buildPromiseChain(packages, async pkg => maybeDownloadPackage(pkg, eventStream, proxy, strictSSL));
    }

    public async InstallPackages(eventStream: EventStream): Promise<void> {
        let packages = await this.GetPackages();
        return util.buildPromiseChain(packages, async pkg => installPackage(pkg, eventStream));
    }

    private async GetAllPackages(): Promise<Package[]> {
        if (this.allPackages) {
            return this.allPackages;
        }
        else {
            throw new PackageError("Package manifest does not exist.");
        }
    }

    private async GetPackages(): Promise<Package[]> {
        let list = await this.GetAllPackages();
        return list.filter(pkg => {
            if (pkg.architectures && pkg.architectures.indexOf(this.platformInfo.architecture) === -1) {
                return false;
            }

            if (pkg.platforms && pkg.platforms.indexOf(this.platformInfo.platform) === -1) {
                return false;
            }

            return true;
        });
    }

    public SetPackagesToDownload(packages: Package[]) {
        this.allPackages = packages;
        resolvePackageBinaries(this.allPackages);
    }

    public async GetLatestVersionFromFile(eventStream: EventStream, proxy: string, strictSSL: boolean, filePackage: Package): Promise<string> {
        try {
            let latestVersion: string;
            await maybeDownloadPackage(filePackage, eventStream, proxy, strictSSL);
            if (filePackage.tmpFile) {
                latestVersion = fs.readFileSync(filePackage.tmpFile.name, 'utf8');
                //Delete the temporary file created
                filePackage.tmpFile.removeCallback();
            }

            return latestVersion;
        }
        catch (error) {
            throw new Error(`Could not download the latest version file due to ${error.toString()}`);
        }
    }
}

function resolvePackageBinaries(packages: Package[]) {
    // Convert relative binary paths to absolute
    if (packages) {
        for (let pkg of packages) {
            if (pkg.binaries) {
                pkg.binaries = pkg.binaries.map(value => path.resolve(getBaseInstallPath(pkg), value));
            }
        }
    }
}

function getBaseInstallPath(pkg: Package): string {
    let basePath = util.getExtensionPath();
    if (pkg.installPath) {
        basePath = path.join(basePath, pkg.installPath);
    }

    return basePath;
}

async function maybeDownloadPackage(pkg: Package, eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<void> {
    let exists = doesPackageTestPathExist(pkg);
    if (!exists) {
        return downloadPackage(pkg, eventStream, proxy, strictSSL);
    } else {
        eventStream.post(new DownloadSuccess(`Skipping package '${pkg.description}' (already downloaded).`));
    }
}

async function downloadPackage(pkg: Package, eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<void> {
    eventStream.post(new DownloadStart(pkg.description));
    const tmpResult = await new Promise<tmp.SynchrounousResult>((resolve, reject) => {
        tmp.file({ prefix: 'package-' }, (err, path, fd, cleanupCallback) => {
            if (err) {
                return reject(new PackageError('Error from tmp.file', pkg, err));
            }

            resolve(<tmp.SynchrounousResult>{ name: path, fd: fd, removeCallback: cleanupCallback });
        });
    });

    pkg.tmpFile = tmpResult;

    try {
        await downloadFile(pkg.url, pkg, eventStream, proxy, strictSSL);
        eventStream.post(new DownloadSuccess(` Done!`));
    }
    catch (primaryUrlError) {
        // If the package has a fallback Url, and downloading from the primary Url failed, try again from 
        // the fallback. This is used for debugger packages as some users have had issues downloading from
        // the CDN link
        if (pkg.fallbackUrl) {
            eventStream.post(new DownloadFallBack(pkg.fallbackUrl));
            try {
                await downloadFile(pkg.fallbackUrl, pkg, eventStream, proxy, strictSSL);
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

async function downloadFile(urlString: string, pkg: Package, eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<void> {
    const url = parseUrl(urlString);

    const options: https.RequestOptions = {
        host: url.host,
        path: url.path,
        agent: getProxyAgent(url, proxy, strictSSL),
        port : url.port,
        rejectUnauthorized: util.isBoolean(strictSSL) ? strictSSL : true
    };

    return new Promise<void>((resolve, reject) => {
        if (!pkg.tmpFile || pkg.tmpFile.fd == 0) {
            return reject(new PackageError("Temporary package file unavailable", pkg));
        }

        let request = https.request(options, response => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                // Redirect - download from new location
                return resolve(downloadFile(response.headers.location, pkg, eventStream, proxy, strictSSL));
            }

            if (response.statusCode != 200) {
                // Download failed - print error message
                eventStream.post(new DownloadFailure(`failed (error code '${response.statusCode}')`));
                return reject(new PackageError(response.statusCode.toString(), pkg));
            }

            // Downloading - hook up events
            let packageSize = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            let downloadPercentage = 0;
            let tmpFile = fs.createWriteStream(null, { fd: pkg.tmpFile.fd });

            eventStream.post(new DownloadSizeObtained(packageSize));

            response.on('data', data => {
                downloadedBytes += data.length;

                // Update status bar item with percentage
                let newPercentage = Math.ceil(100 * (downloadedBytes / packageSize));
                if (newPercentage !== downloadPercentage) {
                    downloadPercentage = newPercentage;
                    eventStream.post(new DownloadProgress(downloadPercentage, pkg.description));
                }
            });

            response.on('end', () => {
                resolve();
            });

            response.on('error', err => {
                reject(new PackageError(`Reponse error: ${err.message || 'NONE'}`, pkg, err));
            });

            // Begin piping data from the response to the package file
            response.pipe(tmpFile, { end: false });
        });

        request.on('error', err => {
            reject(new PackageError(`Request error: ${err.message || 'NONE'}`, pkg, err));
        });

        // Execute the request
        request.end();
    });
}

async function installPackage(pkg: Package, eventStream: EventStream): Promise<void> {
    const installationStage = 'installPackages';
    if (!pkg.tmpFile) {
        // Download of this package was skipped, so there is nothing to install
        return Promise.resolve();
    }

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

async function doesPackageTestPathExist(pkg: Package): Promise<boolean> {
    const testPath = getPackageTestPath(pkg);
    if (testPath) {
        return util.fileExists(testPath);
    } else {
        return Promise.resolve(false);
    }
}

function getPackageTestPath(pkg: Package): string {
    if (pkg.installTestPath) {
        return path.join(util.getExtensionPath(), pkg.installTestPath);
    } else {
        return null;
    }
}