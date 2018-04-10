/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetNetworkConfiguration, IPackageManagerFactory, defaultPackageManagerFactory } from '../downloader.helper';
import { GetPackagesFromVersion, GetVersionFilePackage } from './OmnisharpPackageCreator';
import { Package, PackageManager } from '../packages';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, InstallationProgress } from './loggingEvents';
import { EventStream } from '../EventStream';
import { vscode } from '../vscodeAdapter';


export class OmnisharpDownloader {
    private proxy: string;
    private strictSSL: boolean;
    private packageManager: PackageManager;

    public constructor(
        vscode: vscode,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        packageManagerFactory: IPackageManagerFactory = defaultPackageManagerFactory) {

        let networkConfiguration = GetNetworkConfiguration(vscode);
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
            let packages = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);

            installationStage = 'downloadPackages';

            let downloadedPackages = await this.packageManager.DownloadPackages(packages, this.eventStream, this.proxy, this.strictSSL);

            installationStage = 'installPackages';
            await this.packageManager.InstallPackages(downloadedPackages, this.eventStream);

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
