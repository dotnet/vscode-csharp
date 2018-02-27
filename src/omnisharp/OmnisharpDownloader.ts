/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { PackageManager, Package, Status } from '../packages';
import { PlatformInformation } from '../platform';
import { Logger } from '../logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { GetPackagesFromVersion, GetVersionFilePackage } from './OmnisharpPackageCreator';
import { GetStatus, ReportInstallationError, SendInstallationTelemetry, GetNetworkConfiguration } from '../downloader.helper';

export class OmnisharpDownloader {
    private status: Status;
    private proxy: string;
    private strictSSL: boolean;
    private packageManager: PackageManager;
    private telemetryProps: any;

    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private packageJSON: any,
        private platformInfo: PlatformInformation,
        private reporter?: TelemetryReporter) {

        this.status = GetStatus();
        let networkConfiguration = GetNetworkConfiguration();
        this.proxy = networkConfiguration.Proxy;
        this.strictSSL = networkConfiguration.StrictSSL;
        this.telemetryProps = {};
        this.packageManager = new PackageManager(this.platformInfo, this.packageJSON);
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        this.logger.append('Installing Omnisharp Packages...');
        this.channel.show();

        let installationStage = '';
        
        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

        try {
            installationStage = 'logPlatformInfo';
            this.logger.appendLine();
            this.logger.appendLine(`Platform: ${this.platformInfo.toString()}`);
            this.logger.appendLine();

            installationStage = 'getPackageInfo';
            let packages: Package[] = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);

            installationStage = 'downloadPackages';
            // Specify the packages that the package manager needs to download
            this.packageManager.SetVersionPackagesForDownload(packages);
            await this.packageManager.DownloadPackages(this.logger, this.status, this.proxy, this.strictSSL);

            this.logger.appendLine();

            installationStage = 'installPackages';
            await this.packageManager.InstallPackages(this.logger, this.status);

            installationStage = 'completeSuccess';
        }
        catch (error) {
            ReportInstallationError(this.logger, error, this.telemetryProps, installationStage);
            throw error;// throw the error up to the server
        }
        finally {
            SendInstallationTelemetry(this.logger, this.reporter, this.telemetryProps, installationStage, this.platformInfo);
            this.status.dispose();
        }
    }

    public async GetLatestVersion(serverUrl: string, latestVersionFileServerPath: string): Promise<string> {
        let installationStage = 'getLatestVersionInfoFile';
        try {
            this.logger.appendLine('Getting latest build information...');
            this.logger.appendLine();
            //The package manager needs a package format to download, hence we form a package for the latest version file
            let filePackage = GetVersionFilePackage(serverUrl, latestVersionFileServerPath);
            //Fetch the latest version information from the file
            return await this.packageManager.GetLatestVersionFromFile(this.logger, this.status, this.proxy, this.strictSSL, filePackage);
        }
        catch (error) {
            ReportInstallationError(this.logger, error, this.telemetryProps, installationStage);
            throw error;
        }
    }
}
