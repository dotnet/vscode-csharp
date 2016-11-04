/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import * as coreclrdebug from './coreclr-debug/activate';
import * as OmniSharp from './omnisharp/extension';
import * as util from './common';
import { Logger } from './logger';
import { PackageManager, Status } from './packages';
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

    ensureRuntimeDependencies(extension, logger)
        .then(() => {
            // activate language services
            OmniSharp.activate(context, reporter);

            // activate coreclr-debug
            coreclrdebug.activate(context, reporter, logger);
        });
}

function ensureRuntimeDependencies(extension: vscode.Extension<any>, logger: Logger): Promise<void> {
    return util.installFileExists(util.InstallFileType.Lock)
        .then(exists => {
            if (!exists) {
                return util.touchInstallFile(util.InstallFileType.Begin).then(() => {
                    return installRuntimeDependencies(extension, logger);
                });
            }
        });
}

function installRuntimeDependencies(extension: vscode.Extension<any>, logger: Logger): Promise<void> {
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
    }

    let platformInfo: PlatformInformation;
    let packageManager: PackageManager;
    let installationStage = 'touchBeginFile';
    let errorMessage = '';

    return util.touchInstallFile(util.InstallFileType.Begin)
        .then(() => {
            installationStage = 'getPlatformInfo';
            return PlatformInformation.GetCurrent()
        })
        .then(info => {
            platformInfo = info;
            packageManager = new PackageManager(info, extension.packageJSON);
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
            installationStage = 'deleteBeginFile';
            return util.deleteInstallFile(util.InstallFileType.Begin)
        })
        .catch(error => {
            errorMessage = error.toString();
            logger.appendLine(`Failed at stage: ${installationStage}`);
            logger.appendLine(errorMessage);
        })
        .then(() => {
            logger.appendLine();
            installationStage = '';
            logger.appendLine('Finished');

            // TODO: Send telemetry event

            statusItem.dispose();
        });
}

function allowExecution(filePath: string, platformInfo: PlatformInformation, logger: Logger): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (!platformInfo.isWindows()) {
            util.fileExists(filePath)
                .then(exists => {
                    if (exists) {
                        fs.chmod(filePath, '755', err => {
                            if (err) {
                                return reject(err);
                            }

                            resolve();
                        });
                    }
                    else {
                        logger.appendLine();
                        logger.appendLine(`Warning: Expected file '${filePath}' is missing.`);
                        resolve();
                    }
                });
        }
        else {
            resolve();
        }
    });
}