/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import * as coreclrdebug from './coreclr-debug/activate';
import * as OmniSharp from './omnisharp/extension';
import * as util from './common';
import { Logger } from './logger';
import { PackageManager, Status, PackageError } from './packages';
import { PlatformInformation } from './platform';

let _channel: vscode.OutputChannel = null;

export function activate(context: vscode.ExtensionContext): any {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    _channel = vscode.window.createOutputChannel('C#');

    let logger = new Logger(text => _channel.append(text));

    ensureRuntimeDependencies(extension, logger, reporter)
        .then(() => {
            // activate language services
            OmniSharp.activate(context, reporter);

            // activate coreclr-debug
            coreclrdebug.activate(context, reporter, logger, _channel);
        });
}

function ensureRuntimeDependencies(extension: vscode.Extension<any>, logger: Logger, reporter: TelemetryReporter): Promise<void> {
    return util.installFileExists(util.InstallFileType.Lock)
        .then(exists => {
            if (!exists) {
                return util.touchInstallFile(util.InstallFileType.Begin).then(() => {
                    return installRuntimeDependencies(extension, logger, reporter);
                });
            }
        });
}

function installRuntimeDependencies(extension: vscode.Extension<any>, logger: Logger, reporter: TelemetryReporter): Promise<void> {
    logger.append('Updating C# dependencies...');
    _channel.show();

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

    let platformInfo: PlatformInformation;
    let packageManager: PackageManager;
    let installationStage = 'touchBeginFile';
    let errorMessage = '';

    let telemetryProps: any = {};

    return util.touchInstallFile(util.InstallFileType.Begin)
        .then(() => {
            installationStage = 'getPlatformInfo';
            return PlatformInformation.GetCurrent();
        })
        .then(info => {
            platformInfo = info;
            packageManager = new PackageManager(info, extension.packageJSON);
            logger.appendLine();

            // Display platform information and RID followed by a blank line
            logger.append(`Platform: ${info.toString()}`);
            if (info.runtimeId) {
                logger.appendLine(` (${info.runtimeId})`);
            }
            else {
                logger.appendLine();
            }
            logger.appendLine();

            installationStage = 'downloadPackages';

            const config = vscode.workspace.getConfiguration();
            const proxy = config.get<string>('http.proxy');
            const strictSSL = config.get('http.proxyStrictSSL', true);

            return packageManager.DownloadPackages(logger, status, proxy, strictSSL);
        })
        .then(() => {
            logger.appendLine();

            installationStage = 'installPackages';
            return packageManager.InstallPackages(logger, status);
        })
        .then(() => {
            installationStage = 'touchLockFile';
            return util.touchInstallFile(util.InstallFileType.Lock);
        })
        .then(() => {
            installationStage = 'completeSuccess';
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

            logger.appendLine(`Failed at stage: ${installationStage}`);
            logger.appendLine(errorMessage);
        })
        .then(() => {
            telemetryProps['installStage'] = installationStage;
            telemetryProps['platform.architecture'] = platformInfo.architecture;
            telemetryProps['platform.platform'] = platformInfo.platform;
            telemetryProps['platform.runtimeId'] = platformInfo.runtimeId;
            if (platformInfo.distribution) { 
                telemetryProps['platform.distribution'] = platformInfo.distribution.toString();
            }

            reporter.sendTelemetryEvent('Acquisition', telemetryProps);

            logger.appendLine();
            installationStage = '';
            logger.appendLine('Finished');

            statusItem.dispose();
        })
        .then(() => {
            // We do this step at the end so that we clean up the begin file in the case that we hit above catch block
            // Attach a an empty catch to this so that errors here do not propogate
            return util.deleteInstallFile(util.InstallFileType.Begin).catch((error) => { });
        });
}
