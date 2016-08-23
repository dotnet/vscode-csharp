/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import TelemetryReporter from 'vscode-extension-telemetry';
import { CoreClrDebugUtil } from './util';
import * as debugInstall from './install';
import { Platform, getCurrentPlatform } from './../platform';

let _reporter: TelemetryReporter = null;
let _channel: vscode.OutputChannel = null;
let _util: CoreClrDebugUtil = null;

export function activate(context: vscode.ExtensionContext, reporter: TelemetryReporter) {
    _reporter = reporter;
    _channel = vscode.window.createOutputChannel('coreclr-debug');
    _util = new CoreClrDebugUtil(context.extensionPath, _channel);

    if (CoreClrDebugUtil.existsSync(_util.installCompleteFilePath())) {
        console.log('.NET Core Debugger tools already installed');
        return;
    }

    let dotnetVersion: string = '';
    let osVersion: string = '';
    let osRID: string = '';
    _util.spawnChildProcess('dotnet', ['--info'], _util.coreClrDebugDir(), (data: Buffer) => {
        var lines: string[] = data.toString().replace(/\r/mg, '').split('\n');
        lines.forEach(line => {
            let match: RegExpMatchArray;
            if (match = /^\ Version:\s*([^\s].*)$/.exec(line)) {
                dotnetVersion = match[1];
            } else if (match = /^\ OS Version:\s*([^\s].*)$/.exec(line)) {
                osVersion = match[1];
            } else if (match = /^\ RID:\s*([\w\-\.]+)$/.exec(line)) {
                osRID = match[1];
            }
        });
    }).then(() => {
        let installer = new debugInstall.DebugInstaller(_util);
        _util.createInstallLog();

        let runtimeId = getPlatformRuntimeId();

        let statusBarMessage = vscode.window.setStatusBarMessage("Downloading and configuring the .NET Core Debugger...");

        let installStage: string = "installBegin";
        let installError: string = '';
        let moreErrors: string = '';

        writeInstallBeginFile().then(() => {
            return installer.install(runtimeId);
        }).then(() => {
            installStage = "completeSuccess";
            statusBarMessage.dispose();
            vscode.window.setStatusBarMessage('Successfully installed .NET Core Debugger.');
        }).catch((error: debugInstall.InstallError) => {
                const viewLogMessage = "View Log";
                vscode.window.showErrorMessage('Error while installing .NET Core Debugger.', viewLogMessage).then(value => {
                    if (value === viewLogMessage) {
                        _channel.show(vscode.ViewColumn.Three);
                    }
                });
                statusBarMessage.dispose();

                installStage = error.installStage;
                installError = error.errorMessage;
                moreErrors = error.hasMoreErrors ? 'true' : 'false';
            }).then(() => {
                // log telemetry and delete install begin file
                logTelemetry('Acquisition', {
                    installStage: installStage,
                    installError: installError,
                    moreErrors: moreErrors,
                    dotnetVersion: dotnetVersion,
                    osVersion: osVersion,
                    osRID: osRID
                });
                try {
                    deleteInstallBeginFile();
                } catch (err) {
                    // if this throws there's really nothing we can do
                }
                _util.closeInstallLog();
            });
    }).catch(() => {
        const config = vscode.workspace.getConfiguration('csharp');
        if (!config.get('suppressDotnetInstallWarning', false)) {
            const getDotNetMessage = 'Get .NET CLI tools';
            const goToSettingsMessage = 'Disable this message in user settings';
            // Buttons are shown in right-to-left order, with a close button to the right of everything;
            // getDotNetMessage will be the first button, then goToSettingsMessage, then the close button.
            vscode.window.showErrorMessage('The .NET CLI tools cannot be located. .NET Core debugging will not be enabled. Make sure .NET CLI tools are installed and are on the path.',
                goToSettingsMessage, getDotNetMessage).then(value => {
                    if (value === getDotNetMessage) {
                        let open = require('open');
                        open('https://www.microsoft.com/net/core');
                    } else if (value === goToSettingsMessage) {
                        vscode.commands.executeCommand('workbench.action.openGlobalSettings');
                    }
                });
        }
    });
}

function logTelemetry(eventName: string, properties?: {[prop: string]: string}): void {
    if (_reporter !== null) {
        _reporter.sendTelemetryEvent('coreclr-debug/' + eventName, properties);
    }
}

function writeInstallBeginFile() : Promise<void> {
    return CoreClrDebugUtil.writeEmptyFile(_util.installBeginFilePath());
}

function deleteInstallBeginFile() {
    if (CoreClrDebugUtil.existsSync(_util.installBeginFilePath())) {
        fs.unlinkSync(_util.installBeginFilePath());
    }
}

function getPlatformRuntimeId() : string {
    switch (process.platform) {
        case 'win32':
            return 'win7-x64';
        case 'darwin':
            return 'osx.10.11-x64';
        case 'linux':
            switch (getCurrentPlatform())
            {
                case Platform.CentOS:
                    return 'centos.7-x64';
                case Platform.Fedora:
                    return 'fedora.23-x64';
                case Platform.OpenSUSE:
                    return 'opensuse.13.2-x64';
                case Platform.RHEL:
                    return 'rhel.7-x64';
                case Platform.Debian:
                    return 'debian.8-x64';
                case Platform.Ubuntu14:
                    return 'ubuntu.14.04-x64';
                case Platform.Ubuntu16:
                    return 'ubuntu.16.04-x64';
                default:
                    throw Error('Error: Unsupported linux platform');
            }
        default:
            _util.log('Error: Unsupported platform ' + process.platform);
            throw Error('Unsupported platform ' + process.platform);
    }
}
