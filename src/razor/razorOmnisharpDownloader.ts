/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../shared/platform.js';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from '../shared/loggingEvents.js';
import { EventStream } from '../eventStream.js';
import { NetworkSettingsProvider } from '../networkSettings.js';
import { downloadAndInstallPackages } from '../packageManager/downloadAndInstallPackages.js';
import { getRuntimeDependenciesPackages } from '../tools/runtimeDependencyPackageUtils.js';
import { getAbsolutePathPackagesToInstall } from '../packageManager/getAbsolutePathPackagesToInstall.js';
import { isValidDownload } from '../packageManager/isValidDownload.js';
import { ITelemetryReporter } from '../shared/telemetryReporter.js';

export class RazorOmnisharpDownloader {
    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private extensionPath: string,
        private reporter?: ITelemetryReporter
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
            const installationResults = await downloadAndInstallPackages(
                packagesToInstall,
                this.networkSettingsProvider,
                this.eventStream,
                isValidDownload,
                this.reporter
            );
            const failedPackages = Object.entries(installationResults)
                .filter(([, installed]) => !installed)
                .map(([name]) => name);
            if (failedPackages.length === 0) {
                this.eventStream.post(new InstallationSuccess());
                return true;
            }
        }

        return false;
    }
}
