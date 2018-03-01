/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import * as util from './common';
import { Logger } from './logger';
import { PackageManager } from './packages';
import { PlatformInformation } from './platform';
import { GetStatus, GetNetworkConfiguration, ReportInstallationError, SendInstallationTelemetry } from './downloader.helper';
import { MessageObserver, MessageType } from './omnisharp/messageType';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader {
    public constructor(
        private sink: MessageObserver,
        private reporter: TelemetryReporter /* optional */,
        private packageJSON: any) {
    }

    public async installRuntimeDependencies(): Promise<boolean> {
        this.sink.onNext({ type: MessageType.PackageInstallation, packageInfo: "C# dependencies" });

        let status = GetStatus();

        // Sends "AcquisitionStart" telemetry to indicate an acquisition  started.
        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

        let platformInfo: PlatformInformation;
        let packageManager: PackageManager;
        let installationStage = 'touchBeginFile';
        let success = false;

        let telemetryProps: any = {};

        try {
            await util.touchInstallFile(util.InstallFileType.Begin);
            installationStage = 'getPlatformInfo';
            platformInfo = await PlatformInformation.GetCurrent();

            packageManager = new PackageManager(platformInfo, this.packageJSON);
            // Display platform information and RID followed by a blank line
            this.sink.onNext({ type: MessageType.Platform, info: platformInfo });

            installationStage = 'downloadPackages';

            let networkConfiguration = GetNetworkConfiguration();
            const proxy = networkConfiguration.Proxy;
            const strictSSL = networkConfiguration.StrictSSL;

            await packageManager.DownloadPackages(this.sink, status, proxy, strictSSL);

            installationStage = 'installPackages';
            await packageManager.InstallPackages(this.sink, status);

            installationStage = 'touchLockFile';
            await util.touchInstallFile(util.InstallFileType.Lock);
            
            installationStage = 'completeSuccess';
            success = true;
        }
        catch (error) {
            ReportInstallationError(this.sink, error, telemetryProps, installationStage);
        }
        finally {
            SendInstallationTelemetry(this.sink, this.reporter, telemetryProps, installationStage, platformInfo);
            status.dispose();
            // We do this step at the end so that we clean up the begin file in the case that we hit above catch block
            // Attach a an empty catch to this so that errors here do not propogate
            try {
                util.deleteInstallFile(util.InstallFileType.Begin);
            }
            catch (error) { }
            return success;
        }
    }
}
