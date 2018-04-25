/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { GetPackagesFromVersion } from './OmnisharpPackageCreator';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, LatestBuildDownloadStart } from './loggingEvents';
import { EventStream } from '../EventStream';
import { NetworkSettingsProvider } from '../NetworkSettings';
import { DownloadAndInstallPackages } from '../packageManager/PackageManager';
import { CreateTmpFile, TmpAsset } from '../CreateTmpAsset';
import { DownloadFile } from '../packageManager/FileDownloader';
import { PackageJSONPackage } from '../packageManager/PackageJSONPackage';
import { Package } from '../packageManager/Package';

export class OmnisharpDownloader {

    public constructor(
        private networkSettingsProvider: NetworkSettingsProvider,
        private eventStream: EventStream,
        private platformInfo: PlatformInformation,
        private packageJSON: any,
        private extensionPath: string) {
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        this.eventStream.post(new PackageInstallation(`OmniSharp Version = ${version}`));
        let installationStage = '';

        try {
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));
            installationStage = 'getPackageInfo';
            let packages = this.GetResolvedPackagesFromVersion(version, this.packageJSON, serverUrl, installPath, this.extensionPath);
            installationStage = 'downloadAndInstallPackages';
            await DownloadAndInstallPackages(packages, this.networkSettingsProvider, this.platformInfo, this.eventStream);
            this.eventStream.post(new InstallationSuccess());
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            throw error;// throw the error up to the server
        }
    }

    private GetResolvedPackagesFromVersion(version: string, packageJSON: any, serverUrl: string, installPath: string, extensionPath: string) {
        let runTimeDependencies = <PackageJSONPackage[]>packageJSON.runtimeDependencies;
        let packageJSONpackages = GetPackagesFromVersion(version, runTimeDependencies, serverUrl, installPath);
        return packageJSONpackages.map(pkg => new Package(pkg, extensionPath));
    }

    public async GetLatestVersion(serverUrl: string, latestVersionFileServerPath: string): Promise<string> {
        let description = "Latest Omnisharp Version Information";
        let url = `${serverUrl}/${latestVersionFileServerPath}`;
        let tmpFile: TmpAsset;
        try {
            this.eventStream.post(new LatestBuildDownloadStart());
            tmpFile = await CreateTmpFile();
            await DownloadFile(tmpFile.fd, description, this.eventStream, this.networkSettingsProvider, url);
            return fs.readFileSync(tmpFile.name, 'utf8');
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure('getLatestVersionInfoFile', error));
            throw error;
        }
        finally {
            if (tmpFile) {
                tmpFile.dispose();
            }
        }
    }
}