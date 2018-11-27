/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { Package } from './Package';
import { PackageError } from './PackageError';
import { NestedError } from "../NestedError";
import { DownloadFile } from './FileDownloader';
import { InstallZip } from './ZipInstaller';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from "../NetworkSettings";
import { filterPackages } from "./PackageFilterer";
import { AbsolutePathPackage } from "./AbsolutePathPackage";
import { touchInstallFile, InstallFileType, deleteInstallFile } from "../common";
import { InstallationFailure } from "../omnisharp/loggingEvents";
import { mkdirpSync } from "fs-extra";

export async function DownloadAndInstallPackages(packages: Package[], provider: NetworkSettingsProvider, platformInfo: PlatformInformation, eventStream: EventStream, extensionPath: string): Promise<void> {
    let absolutePathPackages = packages.map(pkg => AbsolutePathPackage.getAbsolutePathPackage(pkg, extensionPath));
    let filteredPackages = await filterPackages(absolutePathPackages, platformInfo);

    if (filteredPackages) {
        for (let pkg of filteredPackages) {
            let installationStage = "touchBeginFile";
            try {
                mkdirpSync(pkg.installPath.value);
                await touchInstallFile(pkg.installPath, InstallFileType.Begin);
                installationStage = 'downloadAndInstallPackages';
                let buffer = await DownloadFile(pkg.description, eventStream, provider, pkg.url, pkg.fallbackUrl);
                await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);
                installationStage = 'touchLockFile';
                await touchInstallFile(pkg.installPath, InstallFileType.Lock);
            }
            catch (error) {
                eventStream.post(new InstallationFailure(installationStage, error));
                if (error instanceof NestedError) {
                    let packageError = new PackageError(error.message, pkg, error.err);
                    eventStream.post(new InstallationFailure(installationStage, packageError));
                    throw packageError;
                }
                else {
                    eventStream.post(new InstallationFailure(installationStage, error));
                    throw error;
                }
            }
            finally {
                await deleteInstallFile(pkg.installPath, InstallFileType.Begin);
            }
        }
    }
}

