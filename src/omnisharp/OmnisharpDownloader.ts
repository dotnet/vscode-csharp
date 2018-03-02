/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetNetworkConfiguration, GetStatus } from '../downloader.helper';
import { GetPackagesFromVersion, GetVersionFilePackage } from './OmnisharpPackageCreator';
import { MessageObserver, MessageType } from './messageType';
import { Package, PackageManager, Status } from '../packages';
import { PlatformInformation } from '../platform';

export class OmnisharpDownloader {
    private status: Status;
    private proxy: string;
    private strictSSL: boolean;
    private packageManager: PackageManager;

    public constructor(
        private sink: MessageObserver,
        private packageJSON: any,
        private platformInfo: PlatformInformation) {

        this.status = GetStatus();
        let networkConfiguration = GetNetworkConfiguration();
        this.proxy = networkConfiguration.Proxy;
        this.strictSSL = networkConfiguration.StrictSSL;
        this.packageManager = new PackageManager(this.platformInfo, this.packageJSON);
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        this.sink.onNext({ type: MessageType.PackageInstallation, packageInfo: `Omnisharp - ${version}` });

        let installationStage = '';

        try {
            installationStage = 'logPlatformInfo';
            this.sink.onNext({ type: MessageType.Platform, info: this.platformInfo });

            installationStage = 'getPackageInfo';
            let packages: Package[] = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);

            installationStage = 'downloadPackages';
            // Specify the packages that the package manager needs to download
            this.packageManager.SetVersionPackagesForDownload(packages);
            await this.packageManager.DownloadPackages(this.sink, this.status, this.proxy, this.strictSSL);

            installationStage = 'installPackages';
            await this.packageManager.InstallPackages(this.sink, this.status);

            this.sink.onNext({ type: MessageType.InstallationSuccess });
        }
        catch (error) {
            this.sink.onNext({ type: MessageType.InstallationFailure, stage: installationStage, error: error });
            throw error;// throw the error up to the server
        }
        finally {
            this.status.dispose();
        }
    }

    public async GetLatestVersion(serverUrl: string, latestVersionFileServerPath: string): Promise<string> {
        let installationStage = 'getLatestVersionInfoFile';
        try {
            this.sink.onNext({ type: MessageType.InstallationProgress, stage: installationStage, message: 'Getting latest build information...' });
            //The package manager needs a package format to download, hence we form a package for the latest version file
            let filePackage = GetVersionFilePackage(serverUrl, latestVersionFileServerPath);
            //Fetch the latest version information from the file
            return await this.packageManager.GetLatestVersionFromFile(this.sink, this.status, this.proxy, this.strictSSL, filePackage);
        }
        catch (error) {
            this.sink.onNext({ type: MessageType.InstallationFailure, stage: installationStage, error: error });
            throw error;
        }
    }
}
