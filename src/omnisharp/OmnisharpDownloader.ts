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
import { MessageObserver, MessageType } from './messageType';

export class OmnisharpDownloader {
    private status: Status;
    private proxy: string;
    private strictSSL: boolean;
    private packageManager: PackageManager;
    private telemetryProps: any;

    public constructor(
        private sink: MessageObserver,
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
        this.sink.onNext({ type: MessageType.OmnisharpInstallation });

        let installationStage = '';

        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

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

            installationStage = 'completeSuccess';
        }
        catch (error) {
            ReportInstallationError(this.sink, error, this.telemetryProps, installationStage);
            throw error;// throw the error up to the server
        }
        finally {
            SendInstallationTelemetry(this.sink, this.reporter, this.telemetryProps, installationStage, this.platformInfo);
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
            ReportInstallationError(this.sink, error, this.telemetryProps, installationStage);
            throw error;
        }
    }
}
