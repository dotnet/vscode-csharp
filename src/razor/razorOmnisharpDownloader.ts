/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../shared/platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from '../shared/loggingEvents';
import { EventStream } from '../eventStream';
import { NetworkSettingsProvider } from '../networkSettings';
import { downloadAndInstallPackages } from '../packageManager/downloadAndInstallPackages';
import { getRuntimeDependenciesPackages } from '../tools/runtimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../packageManager/getAbsolutePathPackagesToInstall';
import { isValidDownload } from '../packageManager/isValidDownload';

export class RazorOmnisharpDownloader {
    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private extensionPath: string
    ) {}

    public async DownloadAndInstallRazorOmnisharp(version: string): Promise<boolean> {
        const runtimeDependencies = getRuntimeDependenciesPackages(this.packageJSON);
        const razorPackages = runtimeDependencies.filter((inputPackage) => inputPackage.id === 'RazorOmnisharp');
        const packagesToInstall = await getAbsolutePathPackagesToInstall(
            razorPackages,
            this.platformInfo,
            this.extensionPath
        );

        if (packagesToInstall.length > 0) {
            this.eventStream.post(new PackageInstallation(`Razor OmniSharp Version = ${version}`));
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            if (
                await downloadAndInstallPackages(
                    packagesToInstall,
                    this.networkSettingsProvider,
                    this.eventStream,
                    isValidDownload
                )
            ) {
                this.eventStream.post(new InstallationSuccess());
                return true;
            }
        }

        return false;
    }
}
