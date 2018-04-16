/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { GetPackagesFromVersion } from './OmnisharpPackageCreator';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, InstallationProgress } from './loggingEvents';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from '../NetworkSettings';
import { DownloadAndInstallPackages } from '../packageManager/PackageManager';
import { createTmpFile, TmpFile } from '../CreateTmpFile';
import { DownloadPackage } from '../packageManager/PackageDownloader';
import { ResolveFilePaths } from '../packageManager/PackageFilePathResolver';

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
            packages.forEach(pkg => ResolveFilePaths(pkg));
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
        let tmpFile: TmpFile;
        try {
            this.eventStream.post(new InstallationProgress(installationStage, 'Getting latest build information...'));
            tmpFile = await createTmpFile();
            latestVersion = await this.DownloadLatestVersionFile(tmpFile, description, url, ""); // no fallback url
            return latestVersion;
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            throw error;
        }
        finally {
            if (tmpFile) {
                tmpFile.dispose();
            }
        }
    }

    //To do: This component will move in a separate file
    private async DownloadLatestVersionFile(tmpFile: TmpFile, description: string, url: string, fallbackUrl: string): Promise<string> {
        await DownloadPackage(tmpFile.fd, description, url, "", this.eventStream, this.provider);
        return fs.readFileSync(tmpFile.name, 'utf8');
    }
}