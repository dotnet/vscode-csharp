/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetNetworkConfiguration } from '../downloader.helper';
import { GetPackagesFromVersion, GetVersionFilePackage } from './OmnisharpPackageCreator';
import { Package, PackageManager } from '../packages';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, InstallationProgress } from './loggingEvents';
import { EventStream } from '../EventStream';

const defaultPackageManagerFactory: IPackageManagerFactory = (platformInfo) => new PackageManager(platformInfo);
export interface IPackageManagerFactory {
    (platformInfo: PlatformInformation): PackageManager;
}

export class OmnisharpDownloader {
    private proxy: string;
    private strictSSL: boolean;
    private packageManager: PackageManager;

    public constructor(
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        packageManagerFactory: IPackageManagerFactory = defaultPackageManagerFactory) {

        let networkConfiguration = GetNetworkConfiguration();
        this.proxy = networkConfiguration.Proxy;
        this.strictSSL = networkConfiguration.StrictSSL;
        this.packageManager = packageManagerFactory(this.platformInfo);
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        this.eventStream.post(new PackageInstallation(`Omnisharp Version = ${version}`));
        let installationStage = '';

        try {
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));

            installationStage = 'getPackageInfo';
            let packages: Package[] = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);

            installationStage = 'downloadPackages';
            // Specify the packages that the package manager needs to download
            this.packageManager.SetPackagesToDownload(packages);
            await this.packageManager.DownloadPackages(this.eventStream, this.proxy, this.strictSSL);

            installationStage = 'installPackages';
            await this.packageManager.InstallPackages(this.eventStream);

            this.eventStream.post(new InstallationSuccess());
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            throw error;// throw the error up to the server
        }
    }

    public async GetLatestVersion(serverUrl: string, latestVersionFileServerPath: string): Promise<string> {
        let installationStage = 'getLatestVersionInfoFile';
        try {
            this.eventStream.post(new InstallationProgress(installationStage, 'Getting latest build information...'));
            //The package manager needs a package format to download, hence we form a package for the latest version file
            let filePackage = GetVersionFilePackage(serverUrl, latestVersionFileServerPath);
            //Fetch the latest version information from the file
            return await this.packageManager.GetLatestVersionFromFile(this.eventStream, this.proxy, this.strictSSL, filePackage);
        }
        catch (error) {
            this.eventStream.post(new InstallationFailure(installationStage, error));
            throw error;
        }
    }
}
