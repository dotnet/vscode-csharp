/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../shared/platform.ts';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from '../shared/loggingEvents.ts';
import { EventStream } from '../eventStream.ts';
import { NetworkSettingsProvider } from '../networkSettings.ts';
import { downloadAndInstallPackages } from '../packageManager/downloadAndInstallPackages.ts';
import { getRuntimeDependenciesPackages } from '../tools/runtimeDependencyPackageUtils.ts';
import { getAbsolutePathPackagesToInstall } from '../packageManager/getAbsolutePathPackagesToInstall.ts';
import { isValidDownload } from '../packageManager/isValidDownload.ts';
import { ITelemetryReporter } from '../shared/telemetryReporter.ts';

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
