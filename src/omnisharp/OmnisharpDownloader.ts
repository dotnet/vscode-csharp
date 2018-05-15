/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetPackagesFromVersion } from './OmnisharpPackageCreator';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, LatestBuildDownloadStart } from './loggingEvents';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from '../NetworkSettings';
import { DownloadAndInstallPackages } from '../packageManager/PackageManager';
import { DownloadFile } from '../packageManager/FileDownloader';
import { ResolveFilePaths } from '../packageManager/PackageFilePathResolver';

export class OmnisharpDownloader {

    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation) {
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        this.eventStream.post(new PackageInstallation(`OmniSharp Version = ${version}`));
        let installationStage = '';

        try {
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            installationStage = 'getPackageInfo';
            let packages = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);
            packages.forEach(pkg => ResolveFilePaths(pkg));
            installationStage = 'downloadAndInstallPackages';
            await DownloadAndInstallPackages(packages, this.networkSettingsProvider, this.platformInfo, this.eventStream);
            this.eventStream.post(new InstallationSuccess());
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            throw error;// throw the error up to the server
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