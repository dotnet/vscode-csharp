/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { Package, PackageError, doesPackageTestPathExist } from './packages';
import { PackageDownloader } from './PackageDownloader';
import { PackageInstaller } from './PackageInstaller';
import { vscode } from '../vscodeAdapter';
import { EventStream } from '../EventStream';

export class PackageManager {
    public constructor() {
    }

    private async filterPackages(packages: Package[], platformInfo: PlatformInformation) {
        let platformPackages = await filterPlatformPackages(packages, platformInfo);
        return filterAlreadyInstalledPackages(platformPackages);
    }

    public async DownloadAndInstallPackages(packages: Package[], vscode: vscode, platformInfo: PlatformInformation, eventStream: EventStream) {
        let filteredPackages = await this.filterPackages(packages, platformInfo);
        if (filteredPackages) {
            let downloader = new PackageDownloader();
            let installer = new PackageInstaller();
            for (let pkg of filteredPackages) {
                await downloader.DownloadPackage(pkg, vscode, eventStream);
                // see into error handling as well
                await installer.InstallPackage(pkg, eventStream);
            }
        }
    }
}

async function filterPlatformPackages(packages: Package[], platformInfo: PlatformInformation) {
    if (packages) {
        return packages.filter(pkg => {
            if (pkg.architectures && pkg.architectures.indexOf(platformInfo.architecture) === -1) {
                return false;
            }

            if (pkg.platforms && pkg.platforms.indexOf(platformInfo.platform) === -1) {
                return false;
            }

            return true;
        });
    }
    else {
        throw new PackageError("Package manifest does not exist.");
    }
}

async function filterAlreadyInstalledPackages(packages: Package[]) {
    return packages.filter(async pkg => {
        if (await doesPackageTestPathExist(pkg)) {
            return false; // do not download the already installed packages
        }
        else {
            return true;
        }
    });
}