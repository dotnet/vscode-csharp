/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Status, PackageManager, Package } from '../packages';
import { PlatformInformation } from '../platform';
import { Logger } from '../logger';
import TelemetryReporter from 'vscode-extension-telemetry';
import { GetDownloadDependencies, GetStatus, GetPlatformInformation, SendTelemetry, ReportError } from '../downloadHelper';
import { GetPackagesFromVersion } from './experimentalPackageCreator';

export class OmnisharpDownloader {

    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private reporter: TelemetryReporter /* optional */,
        private packageJSON: any) {
    }

    public async DownloadAndInstallExperimentalVersion(version: string, serverUrl: string, installPath: string) {
        this.logger.append('Getting the version packages...');
        this.channel.show();

        let statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        let status = GetStatus(statusItem);

        let telemetryProps: any = {};
        let installationStage = '';
        let latestVersion: string;
        let platformInfo: PlatformInformation;

        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

        try {
            installationStage = 'getPlatformInfo';
            platformInfo = await GetPlatformInformation(this.logger);
            installationStage = 'downloadPackages';
            let dep = await GetDownloadDependencies(this.reporter, this.logger, this.channel, this.packageJSON, platformInfo);
            let packageManager = dep.PackageManager;
            let proxy = dep.Proxy;
            let strictSSL = dep.StrictSSL;
            let packages: Package[] = GetPackagesFromVersion(version, this.packageJSON.runtimeDependencies, serverUrl, installPath);
            packageManager.SetVersionPackagesForDownload(packages);
            await packageManager.DownloadPackages(this.logger, status, proxy, strictSSL);

            this.logger.appendLine();

            installationStage = 'installPackages';
            await packageManager.InstallPackages(this.logger, status);

            installationStage = 'completeSuccess';
        }

        catch (error) {
            ReportError(this.logger, error, telemetryProps, installationStage);
            throw error;
        }
        finally {
            SendTelemetry(this.logger, this.reporter, telemetryProps, installationStage, platformInfo, statusItem);
        }
    }
}
