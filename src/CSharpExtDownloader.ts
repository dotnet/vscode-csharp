/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import * as util from './common';
import { Logger } from './logger';
import { PackageManager, Status, PackageError } from './packages';
import { PlatformInformation } from './platform';

/*
 * Class used to download the runtime dependencies of the C# Extension
 */
export class CSharpExtDownloader
{
    public constructor(
        private channel: vscode.OutputChannel,
        private logger: Logger,
        private reporter: TelemetryReporter /* optional */,
        private packageJSON: any) {
    }

    public installRuntimeDependencies(): Promise<boolean> {
        this.logger.append('Updating C# dependencies...');
        this.channel.show();

        let statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        let status: Status = {
            setMessage: text => {
                statusItem.text = text;
                statusItem.show();
            },
            setDetail: text => {
                statusItem.tooltip = text;
                statusItem.show();
            }
        };

        // Sends "AcquisitionStart" telemetry to indicate an acquisition  started.
        if (this.reporter) {
            this.reporter.sendTelemetryEvent("AcquisitionStart");
        }

        let platformInfo: PlatformInformation;
        let packageManager: PackageManager;
        let installationStage = 'touchBeginFile';
        let errorMessage = '';
        let success = false;

        let telemetryProps: any = {};

        return util.touchInstallFile(util.InstallFileType.Begin)
            .then(() => {
                installationStage = 'getPlatformInfo';
                return PlatformInformation.GetCurrent();
            })
            .then(info => {
                platformInfo = info;
                packageManager = new PackageManager(info, this.packageJSON);
                this.logger.appendLine();

                // Display platform information and RID followed by a blank line
                this.logger.appendLine(`Platform: ${info.toString()}`);
                this.logger.appendLine();

                installationStage = 'downloadPackages';

                const config = vscode.workspace.getConfiguration();
                const proxy = config.get<string>('http.proxy');
                const strictSSL = config.get('http.proxyStrictSSL', true);

                return packageManager.DownloadPackages(this.logger, status, proxy, strictSSL);
            })
            .then(() => {
                this.logger.appendLine();

                installationStage = 'installPackages';
                return packageManager.InstallPackages(this.logger, status);
            })
            .then(() => {
                installationStage = 'touchLockFile';
                return util.touchInstallFile(util.InstallFileType.Lock);
            })
            .then(() => {
                installationStage = 'completeSuccess';
                success = true;
            })
            .catch(error => {
                if (error instanceof PackageError) {
                    // we can log the message in a PackageError to telemetry as we do not put PII in PackageError messages
                    telemetryProps['error.message'] = error.message;

                    if (error.innerError) {
                        errorMessage = error.innerError.toString();
                    } else {
                        errorMessage = error.message;
                    }

                    if (error.pkg) {
                        telemetryProps['error.packageUrl'] = error.pkg.url;
                    }

                } else {
                    // do not log raw errorMessage in telemetry as it is likely to contain PII.
                    errorMessage = error.toString();
                }

                this.logger.appendLine(`Failed at stage: ${installationStage}`);
                this.logger.appendLine(errorMessage);
            })
            .then(() => {
                telemetryProps['installStage'] = installationStage;
                telemetryProps['platform.architecture'] = platformInfo.architecture;
                telemetryProps['platform.platform'] = platformInfo.platform;
                if (platformInfo.distribution) {
                    telemetryProps['platform.distribution'] = platformInfo.distribution.toTelemetryString();
                }

                if (this.reporter) {
                    this.reporter.sendTelemetryEvent('Acquisition', telemetryProps);
                }

                this.logger.appendLine();
                installationStage = '';
                this.logger.appendLine('Finished');

                statusItem.dispose();
            })
            .then(() => {
                // We do this step at the end so that we clean up the begin file in the case that we hit above catch block
                // Attach a an empty catch to this so that errors here do not propogate
                return util.deleteInstallFile(util.InstallFileType.Begin).catch((error) => { });
            }).then(() => {
                return success;
            });
        
    }
}
