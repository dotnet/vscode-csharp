/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { Package, PackageError, NestedError } from './packages';
import { DownloadPackage } from './PackageDownloader';
import { InstallPackage } from './PackageInstaller';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from "../NetworkSettings";
import { filterPackages } from "./PackageFilterer";
import { TmpFileManager } from './TmpFIleManager';

//Package manager needs a list of packages to be filtered based on platformInfo then download and install them
export async function DownloadAndInstallPackages(packages: Package[], provider: NetworkSettingsProvider, platformInfo: PlatformInformation, eventStream: EventStream) {
    let filteredPackages = await filterPackages(packages, platformInfo);
    if (filteredPackages) {
        for (let pkg of filteredPackages) {
            let tmpFileManager: TmpFileManager;
            try {
                tmpFileManager = new TmpFileManager();
                let tmpFile = await tmpFileManager.GetTmpFile();
                await DownloadPackage(tmpFile.fd, pkg.description, pkg.url, pkg.fallbackUrl, eventStream, provider);
                await InstallPackage(tmpFile.fd, pkg.description, pkg.installPath, pkg.installTestPath, pkg.binaries, eventStream);
            }
            catch (error) {
                if (error instanceof NestedError) {
                    throw new PackageError(error.message, pkg, error.err);
                }
                else {
                    throw error;
                }
            }
            finally {
                //clean the temporary file
                if (tmpFileManager) {
                    await tmpFileManager.CleanUpTmpFile();
                }
                tmpFileManager = null;
            }
        }
    }
}

