/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PackageError } from './PackageError';
import { NestedError } from "../NestedError";
import { DownloadFile } from './FileDownloader';
import { InstallZip } from './ZipInstaller';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from "../NetworkSettings";
import { AbsolutePathPackage } from "./AbsolutePathPackage";
import { touchInstallFile, InstallFileType, deleteInstallFile, installFileExists } from "../common";
import { InstallationFailure } from "../omnisharp/loggingEvents";
import { mkdirpSync } from "fs-extra";
import { PackageInstallStart } from "../omnisharp/loggingEvents";
import { isValidInstallation } from './isValidInstallation';

export async function downloadAndInstallPackages(packages: AbsolutePathPackage[], provider: NetworkSettingsProvider, eventStream: EventStream) {
    if (packages) {
        eventStream.post(new PackageInstallStart());
        for (let pkg of packages) {
            let installationStage = "touchBeginFile";
            try {
                mkdirpSync(pkg.installPath.value);
                await touchInstallFile(pkg.installPath, InstallFileType.Begin);
                installationStage = 'downloadAndInstallPackages';
                let buffer = await DownloadFile(pkg.description, eventStream, provider, pkg.url, pkg.fallbackUrl);
                await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);
                installationStage = 'touchLockFile';
                if (isValidInstallation(pkg.installPath, pkg.sha)) {
                    await touchInstallFile(pkg.installPath, InstallFileType.Lock);
                }
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
                try {
                    if (await installFileExists(pkg.installPath, InstallFileType.Begin)) {
                        await deleteInstallFile(pkg.installPath, InstallFileType.Begin);
                    }
                }
                catch (error) { }
            }
        }
    }
}
