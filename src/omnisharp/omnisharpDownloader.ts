/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetPackagesFromVersion } from './omnisharpPackageCreator.ts';
import { PlatformInformation } from '../shared/platform.ts';
import {
    PackageInstallation,
    LogPlatformInfo,
    InstallationSuccess,
    InstallationFailure,
} from '../shared/loggingEvents.ts';
import { EventStream } from '../eventStream.ts';
import { NetworkSettingsProvider } from '../networkSettings.ts';
import { downloadAndInstallPackages } from '../packageManager/downloadAndInstallPackages.ts';
import { DownloadFile } from '../packageManager/fileDownloader.ts';
import { getRuntimeDependenciesPackages } from '../tools/runtimeDependencyPackageUtils.ts';
import { getAbsolutePathPackagesToInstall } from '../packageManager/getAbsolutePathPackagesToInstall.ts';
import { isValidDownload } from '../packageManager/isValidDownload.ts';
import { LatestBuildDownloadStart } from './omnisharpLoggingEvents.ts';
import { ITelemetryReporter } from '../shared/telemetryReporter.ts';

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
        useFramework: boolean,
        serverUrl: string,
        installPath: string
    ): Promise<boolean> {
        const runtimeDependencies = getRuntimeDependenciesPackages(this.packageJSON);
        const omniSharpPackages = GetPackagesFromVersion(
            version,
            useFramework,
            runtimeDependencies,
            serverUrl,
            installPath
        );
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

    public async GetLatestVersion(serverUrl: string, latestVersionFileServerPath: string): Promise<string> {
        const description = 'Latest OmniSharp Version Information';
        const url = `${serverUrl}/${latestVersionFileServerPath}`;
        try {
            this.eventStream.post(new LatestBuildDownloadStart());
            const versionBuffer = await DownloadFile(description, this.eventStream, this.networkSettingsProvider, url);
            return versionBuffer.toString('utf8');
        } catch (error) {
            this.eventStream.post(new InstallationFailure('getLatestVersionInfoFile', error));
            throw error;
        }
    }
}
