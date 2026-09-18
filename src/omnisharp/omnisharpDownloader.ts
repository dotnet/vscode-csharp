/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetPackagesFromVersion } from './omnisharpPackageCreator';
import { PlatformInformation } from '../shared/platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess } from '../shared/loggingEvents';
import { EventStream } from '../eventStream';
import { NetworkSettingsProvider } from '../networkSettings';
import { downloadAndInstallPackages } from '../packageManager/downloadAndInstallPackages';
import { getRuntimeDependenciesPackages } from '../tools/runtimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../packageManager/getAbsolutePathPackagesToInstall';
import { isValidDownload } from '../packageManager/isValidDownload';
import { ITelemetryReporter } from '../shared/telemetryReporter';

export class OmnisharpDownloader {
    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private extensionPath: string,
        private reporter?: ITelemetryReporter
    ) {}

    public async DownloadAndInstallOmnisharp(
        version: string,
        serverUrl: string,
        installPath: string
    ): Promise<boolean> {
        const runtimeDependencies = getRuntimeDependenciesPackages(this.packageJSON);
        const omniSharpPackages = GetPackagesFromVersion(version, runtimeDependencies, serverUrl, installPath);
        const packagesToInstall = await getAbsolutePathPackagesToInstall(
            omniSharpPackages,
            this.platformInfo,
            this.extensionPath
        );
        if (packagesToInstall.length > 0) {
            this.eventStream.post(new PackageInstallation(`OmniSharp Version = ${version}`));
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
