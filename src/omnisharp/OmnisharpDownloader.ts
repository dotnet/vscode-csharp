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
import { SetStatus, LogPlatformInformation, ReportInstallationError, SendInstallationTelemetry, GetNetworkDependencies } from '../OmnisharpDownload.Helper';

export class OmnisharpDownloader {
    private status: Status;
    private statusItem: vscode.StatusBarItem;
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

        let statusObject = SetStatus();
        this.status = statusObject.Status;
        this.statusItem = statusObject.StatusItem;

        let networkObject = GetNetworkDependencies();
        this.proxy = networkObject.Proxy;
        this.strictSSL = networkObject.StrictSSL;

        this.telemetryProps = {};
        this.packageManager = new PackageManager(this.platformInfo, this.packageJSON);
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        if (!version) {
            throw new Error('Invalid version');
        }

        this.logger.appendLine('Installing Omnisharp Packages...');
        this.logger.appendLine();
        this.channel.show();

        let installationStage = '';

        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

        try {
            LogPlatformInformation(this.logger, this.platformInfo);

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
            SendInstallationTelemetry(this.logger, this.reporter, this.telemetryProps, installationStage, this.platformInfo, this.statusItem);
        }
    }

    public async GetLatestVersion(serverUrl: string, versionFilePathInServer): Promise<string> {
        let installationStage = 'getLatestVersionInfoFile';
        try {
            this.logger.appendLine('Getting latest build information...');
            this.logger.appendLine();

            let filePackage = GetVersionFilePackage(serverUrl, versionFilePathInServer);
            //Fetch the latest version information from the file
            return await this.packageManager.GetLatestVersionFromFile(this.logger, this.status, this.proxy, this.strictSSL, filePackage);
        }
        catch (error) {
            ReportInstallationError(this.logger, error, this.telemetryProps, installationStage);
            throw error;
        }
    }
}
