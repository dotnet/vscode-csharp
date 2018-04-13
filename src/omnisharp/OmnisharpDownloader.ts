/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as tmp from 'tmp';
import { GetPackagesFromVersion } from './OmnisharpPackageCreator';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, InstallationProgress } from './loggingEvents';
import { EventStream } from '../EventStream';
import { DownloadAndInstallPackages } from '../packageManager/PackageManager';
import { NetworkSettingsProvider } from '../NetworkSettings';
import { DownloadPackage } from '../packageManager/PackageDownloader';
import { TmpFileManager } from '../packageManager/TmpFileManager';

export class OmnisharpDownloader {

    public constructor(
        private provider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation) {
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        this.eventStream.post(new PackageInstallation(`Omnisharp Version = ${version}`));
        let installationStage = '';

        try {
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            installationStage = 'getPackageInfo';
            let packages = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);
            installationStage = 'downloadAndInstallPackages';
            await DownloadAndInstallPackages(packages, this.provider, this.platformInfo, this.eventStream);
            this.eventStream.post(new InstallationSuccess());
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            throw error;// throw the error up to the server
        }
    }

    public async GetLatestVersion(serverUrl: string, latestVersionFileServerPath: string) {
        let installationStage = 'getLatestVersionInfoFile';
        let description = "Latest Omnisharp Version Information";
        let url = `${serverUrl}/${latestVersionFileServerPath}`;
        let latestVersion: string;
        let tmpFileManager = new TmpFileManager();
        try {
            this.eventStream.post(new InstallationProgress(installationStage, 'Getting latest build information...'));
            let tmpFile = await tmpFileManager.GetTmpFile();
            latestVersion = await this.DownloadLatestVersionFile(tmpFile, description, url, ""); // no fallback url
            return latestVersion;
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            throw error;
        }
        finally {
            tmpFileManager.CleanUpTmpFile();
        }
    }

    //To do: This component will move in a separate file
    private async DownloadLatestVersionFile(tmpFile: tmp.SynchrounousResult, description: string, url: string, fallbackUrl: string): Promise<string> {
        await DownloadPackage(tmpFile.fd, description, url, "", this.eventStream, this.provider);
        return fs.readFileSync(tmpFile.name, 'utf8');
    }
}