/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PackageError } from './packageError';
import { NestedError } from '../nestedError';
import { DownloadFile } from './fileDownloader';
import { InstallZip } from './zipInstaller';
import { EventStream } from '../eventStream';
import { NetworkSettingsProvider } from '../networkSettings';
import { AbsolutePathPackage } from './absolutePathPackage';
import { touchInstallFile, InstallFileType, deleteInstallFile, installFileExists } from '../common';
import { InstallationFailure, IntegrityCheckFailure } from '../shared/loggingEvents';
import { mkdirpSync } from 'fs-extra';
import { PackageInstallStart } from '../shared/loggingEvents';
import { DownloadValidator } from './isValidDownload';
import { CancellationToken } from 'vscode';

export async function downloadAndInstallPackages(
    packages: AbsolutePathPackage[],
    provider: NetworkSettingsProvider,
    eventStream: EventStream,
    downloadValidator: DownloadValidator,
    token?: CancellationToken
): Promise<boolean> {
    eventStream.post(new PackageInstallStart());
    for (const pkg of packages) {
        let installationStage = 'touchBeginFile';
        try {
            mkdirpSync(pkg.installPath.value);
            await touchInstallFile(pkg.installPath, InstallFileType.Begin);
            let count = 1;
            const willTryInstallingPackage = () => count <= 2; // try 2 times
            while (willTryInstallingPackage()) {
                count = count + 1;
                installationStage = 'downloadPackage';
                const buffer = await DownloadFile(
                    pkg.description,
                    eventStream,
                    provider,
                    pkg.url,
                    pkg.fallbackUrl,
                    token
                );
                if (downloadValidator(buffer, pkg.integrity, eventStream)) {
                    installationStage = 'installPackage';
                    await InstallZip(buffer, pkg.description, pkg.installPath, pkg.binaries, eventStream);
                    installationStage = 'touchLockFile';
                    await touchInstallFile(pkg.installPath, InstallFileType.Lock);
                    break;
                } else {
                    eventStream.post(new IntegrityCheckFailure(pkg.description, pkg.url, willTryInstallingPackage()));
                }
            }
        } catch (error) {
            if (error instanceof NestedError) {
                const packageError = new PackageError(error.message, pkg, error.err);
                eventStream.post(new InstallationFailure(installationStage, packageError));
            } else {
                eventStream.post(new InstallationFailure(installationStage, error));
            }

            return false;
        } finally {
            try {
                if (await installFileExists(pkg.installPath, InstallFileType.Begin)) {
                    await deleteInstallFile(pkg.installPath, InstallFileType.Begin);
                }
            } catch (_) {
                /* empty */
            }
        }
    }

    return true;
}
