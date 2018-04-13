/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as util from '../common';

export interface Package {
    description: string;
    url: string;
    fallbackUrl?: string;
    installPath?: string;
    platforms: string[];
    architectures: string[];
    binaries: string[];
    platformId?: string;

    // Path to use to test if the package has already been installed
    installTestPath?: string;
}

export class NestedError extends Error {
    constructor(public message: string, public err: any = null) {
        super(message);
    }
}

export class PackageError extends NestedError {
    // Do not put PII (personally identifiable information) in the 'message' field as it will be logged to telemetry
    constructor(public message: string,
        public pkg: Package = null,
        public innerError: any = null) {
        super(message, innerError);
    }
}

/*export class PackageManager {
    public constructor() { 
  

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

/*
Reolve all the paths here
*/

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

