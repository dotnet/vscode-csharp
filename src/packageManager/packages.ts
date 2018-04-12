/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as tmp from 'tmp';
import * as util from '../common';

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
        public packageDescription: string = null,
        public innerError: any = null) {
        super(message);
    }
}

/*export class PackageManager {
    public constructor() { }

    public async DownloadPackages(packages: Package[], eventStream: EventStream, proxy: string, strictSSL: boolean): Promise<Package[]> {
        let packagesToDownload = await this.GetPackages(packages);
        for(let pkg of packagesToDownload){
            await maybeDownloadPackage(pkg, eventStream, proxy, strictSSL);
        }
        return packagesToDownload;
    }

    public async InstallPackages(packages: Package[], eventStream: EventStream): Promise<void> {
        let packagesToInstall = await this.GetPackages(packages);
        return util.buildPromiseChain(packagesToInstall, async pkg => installPackage(pkg, eventStream));
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
}*/

export function getBaseInstallPath(pkg: Package): string {
    let basePath = util.getExtensionPath();
    if (pkg.installPath) {
        basePath = path.join(basePath, pkg.installPath);
    }

    return basePath;
}

export async function doesPackageTestPathExist(pkg: Package): Promise<boolean> {
    const testPath = getPackageTestPath(pkg);
    if (testPath) {
        return util.fileExists(testPath);
    }
    else {
        return Promise.resolve(false);
    }
}

export function getPackageTestPath(pkg: Package): string {
    if (pkg.installTestPath) {
        return path.join(util.getExtensionPath(), pkg.installTestPath);
    }
    else {
        return null;
    }
}

