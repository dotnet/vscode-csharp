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

export function activate(context: vscode.ExtensionContext): any {

    const extensionId = 'ms-vscode.csharp';
    const extension = vscode.extensions.getExtension(extensionId);
    const extensionVersion = extension.packageJSON.version;
    const aiKey = extension.packageJSON.contributes.debuggers[0].aiKey;
    const reporter = new TelemetryReporter(extensionId, extensionVersion, aiKey);

    util.setExtensionPath(extension.extensionPath);

    ensureRuntimeDependencies(extension)
        .then(() => {
            // activate language services
            OmniSharp.activate(context, reporter);

            // activate coreclr-debug
            coreclrdebug.activate(context, reporter);
        });
}

function ensureRuntimeDependencies(extension: vscode.Extension<any>): Promise<void> {
    return util.lockFileExists()
        .then(exists => {
            if (!exists) {
                return installRuntimeDependencies(extension);
            }
        });
}

function installRuntimeDependencies(extension: vscode.Extension<any>): Promise<void> {
    let channel = vscode.window.createOutputChannel('C#');
    channel.show();

    let logger = new Logger(text => channel.append(text));
    logger.appendLine('Updating C# dependencies...');

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
    let installationStage = 'getPlatformInfo';
    let errorMessage = '';

    return PlatformInformation.GetCurrent()
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
            return util.touchLockFile();
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