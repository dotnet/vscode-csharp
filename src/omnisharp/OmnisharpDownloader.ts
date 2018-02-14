/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { PackageManager, Package } from '../packages';
import { PlatformInformation } from '../platform';
import { Logger } from '../logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { GetPackagesFromVersion, GetVersionFilePackage } from './OmnisharpPackageCreator';
import { SetStatus, LogPlatformInformation, ReportInstallationError, SendInstallationTelemetry, GetNetworkDependencies } from '../OmnisharpDownload.Helper';

export class OmnisharpDownloader {
    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private packageJSON: any,
        private reporter?: TelemetryReporter) {
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string, platformInfo: PlatformInformation) {
        if (!version) {
            throw new Error('Invalid version');
        }

        this.logger.appendLine('Installing Omnisharp Packages...');
        this.logger.appendLine();
        this.channel.show();

        let statusObject = SetStatus();
        let status = statusObject.Status;
        let statusItem = statusObject.StatusItem;

        let networkObject = GetNetworkDependencies();
        let proxy = networkObject.Proxy;
        let strictSSL = networkObject.StrictSSL;

        let telemetryProps: any = {};
        let installationStage = '';

        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

        try {
            LogPlatformInformation(this.logger, platformInfo);
            let packageManager = new PackageManager(platformInfo, this.packageJSON);

            if (version == "latest") {
                installationStage = 'getLatestVersionInfoFile';

                this.logger.appendLine('Getting latest build information...');
                this.logger.appendLine();
                

                let filePackage = GetVersionFilePackage(serverUrl);
                //Fetch the latest version information from the file
                version = await packageManager.GetLatestVersionFromFile(this.logger, status, proxy, strictSSL, filePackage);
            }

            installationStage = 'getPackageInfo';
            let packages: Package[] = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);

            installationStage = 'downloadPackages';
            
            // Specify the packages that the package manager needs to download
            packageManager.SetVersionPackagesForDownload(packages);
            await packageManager.DownloadPackages(this.logger, status, proxy, strictSSL);

            this.logger.appendLine();

            installationStage = 'installPackages';
            await packageManager.InstallPackages(this.logger, status);

            installationStage = 'completeSuccess';
        }
        catch (error) {
            ReportInstallationError(this.logger, error, telemetryProps, installationStage);
            throw error;// throw the error up to the server
        }
        finally {
            SendInstallationTelemetry(this.logger, this.reporter, telemetryProps, installationStage, platformInfo, statusItem);
        }
    }
}
