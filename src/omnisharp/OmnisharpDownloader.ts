/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { PackageManager, Package } from '../packages';
import { PlatformInformation } from '../platform';
import { Logger } from '../logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { GetPackagesFromVersion } from './OmnisharpPackageCreator';
import { GetDependenciesAndDownloadPackages, SetStatus, GetAndLogPlatformInformation, ReportInstallationError, SendInstallationTelemetry } from '../OmnisharpDownload.Helper';

export class OmnisharpDownloader {
    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private packageJSON: any,
        private reporter?: TelemetryReporter) {
    }

    public async DownloadAndInstallOmnisharp(version: string, serverUrl: string, installPath: string) {
        if (!version) {
            throw new Error('Invalid version');
        }

        this.logger.append('Installing Omnisharp Packages...');
        this.logger.appendLine();
        this.channel.show();

        let statusObject = SetStatus();
        let status = statusObject.Status;
        let statusItem = statusObject.StatusItem;

        let telemetryProps: any = {};
        let installationStage = '';
        let platformInfo: PlatformInformation;

        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

        try {
            installationStage = 'getPlatformInfo';
            platformInfo = await GetAndLogPlatformInformation(this.logger);

            installationStage = 'getPackageInfo';
            let packages: Package[] = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);

            installationStage = 'downloadPackages';
            let packageManager = new PackageManager(platformInfo, this.packageJSON);
            // Specify the packages that the package manager needs to download
            packageManager.SetVersionPackagesForDownload(packages);
            await GetDependenciesAndDownloadPackages(packages,status, platformInfo, packageManager, this.logger);

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
