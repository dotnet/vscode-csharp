/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GetPackagesFromVersion, GetVersionFilePackage } from './OmnisharpPackageCreator';
import { PlatformInformation } from '../platform';
import { PackageInstallation, LogPlatformInfo, InstallationSuccess, InstallationFailure, InstallationProgress } from './loggingEvents';
import { EventStream } from '../EventStream';
import { vscode } from '../vscodeAdapter';
import { PackageManager } from '../packageManager/PackageManager';


export class OmnisharpDownloader {
    private proxy: string;
    private strictSSL: boolean;
    private packageManager: PackageManager;

    public constructor(
        private vscode: vscode,
        private eventStream: EventStream,
        private packageJSON: any,
        private platformInfo: PlatformInformation) {

        this.packageManager = new PackageManager();
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        this.eventStream.post(new PackageInstallation(`Omnisharp Version = ${version}`));
        let installationStage = '';

        try {
            this.eventStream.post(new LogPlatformInfo(this.platformInfo));

            installationStage = 'getPackageInfo';
            let packages = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);

            installationStage = 'downloadAndInstallPackages';
            await this.packageManager.DownloadAndInstallPackages(packages, this.vscode, this.platformInfo, this.eventStream);

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
