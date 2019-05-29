/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetPackagesFromVersion } from './OmnisharpPackageCreator';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, LatestBuildDownloadStart } from './loggingEvents';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from '../NetworkSettings';
import { downloadAndInstallPackages } from '../packageManager/downloadAndInstallPackages';
import { DownloadFile } from '../packageManager/FileDownloader';
import { getRuntimeDependenciesPackages } from '../tools/RuntimeDependencyPackageUtils';
import { getAbsolutePathPackagesToInstall } from '../packageManager/getAbsolutePathPackagesToInstall';
import { isValidDownload } from '../packageManager/isValidDownload';

export class OmnisharpDownloader {

    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private extensionPath: string) {
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string): Promise<boolean> {
        let runtimeDependencies = getRuntimeDependenciesPackages(this.packageJSON);
        let omniSharpPackages = GetPackagesFromVersion(version, runtimeDependencies, serverUrl, installPath);
        let packagesToInstall = await getAbsolutePathPackagesToInstall(omniSharpPackages, this.platformInfo, this.extensionPath);
        if (packagesToInstall && packagesToInstall.length > 0) {
            this.eventStream.post(new PackageInstallation(`OmniSharp Version = ${version}`));
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            if (await downloadAndInstallPackages(packagesToInstall, this.networkSettingsProvider, this.eventStream, isValidDownload)) {
                this.eventStream.post(new InstallationSuccess());
                return true;
            }

            return false;
        }
    }

    public async GetLatestVersion(serverUrl: string, latestVersionFileServerPath: string): Promise<string> {
        let description = "Latest OmniSharp Version Information";
        let url = `${serverUrl}/${latestVersionFileServerPath}`;
        try {
            this.eventStream.post(new LatestBuildDownloadStart());
            let versionBuffer = await DownloadFile(description, this.eventStream, this.networkSettingsProvider, url);
            return versionBuffer.toString('utf8');
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure('getLatestVersionInfoFile', error));
            throw error;
        }
    }
}