/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PackageError } from './PackageError';
import { NestedError } from "../NestedError";
import { DownloadFile } from './FileDownloader';
import { InstallTarGz } from './TarGzInstaller';
import { InstallZip } from './ZipInstaller';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from "../NetworkSettings";
import { AbsolutePathPackage } from "./AbsolutePathPackage";
import { touchInstallFile, InstallFileType, deleteInstallFile, installFileExists } from "../common";
import { InstallationFailure, IntegrityCheckFailure } from "../omnisharp/loggingEvents";
import { mkdirpSync } from "fs-extra";
import { PackageInstallStart } from "../omnisharp/loggingEvents";
import { DownloadValidator } from './isValidDownload';

export async function downloadAndInstallPackages(packages: AbsolutePathPackage[], provider: NetworkSettingsProvider, eventStream: EventStream, downloadValidator: DownloadValidator): Promise<boolean> {
    if (packages) {
        eventStream.post(new PackageInstallStart());
        for (let pkg of packages) {
            let installationStage = "touchBeginFile";
            try {
                mkdirpSync(pkg.installPath.value);
                await touchInstallFile(pkg.installPath, InstallFileType.Begin);
                let count = 1;
                let willTryInstallingPackage = () => count <= 2; // try 2 times
                while (willTryInstallingPackage()) {
                    count = count + 1;
                    installationStage = "downloadPackage";
                    let buffer = await DownloadFile(pkg.description, eventStream, provider, pkg.url, pkg.fallbackUrl);
                    if (downloadValidator(buffer, pkg.integrity, eventStream)) {
                        installationStage = "installPackage";
                        if (pkg.url.includes(".tar.gz")) {
                            await InstallTarGz(buffer, pkg.description, pkg.installPath, eventStream);
                        }
                        else {
                            await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);
                        }

                        installationStage = 'touchLockFile';
                        await touchInstallFile(pkg.installPath, InstallFileType.Lock);
                        break;
                    }
                    else {
                        eventStream.post(new IntegrityCheckFailure(pkg.description, pkg.url, willTryInstallingPackage()));
                    }
                }
            }
            catch (error) {
                if (error instanceof NestedError) {
                    let packageError = new PackageError(error.message, pkg, error.err);
                    eventStream.post(new InstallationFailure(installationStage, packageError));
                }
                else {
                    eventStream.post(new InstallationFailure(installationStage, error));
                }

                return false;
            }
            finally {
                try {
                    if (await installFileExists(pkg.installPath, InstallFileType.Begin)) {
                        await deleteInstallFile(pkg.installPath, InstallFileType.Begin);
                    }
                }
                catch (error) { }
            }
        }

        return true; //if all packages succeded in installing return true
    }
}
