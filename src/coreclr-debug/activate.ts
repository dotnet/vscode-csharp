/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import TelemetryReporter from 'vscode-extension-telemetry';
import { CoreClrDebugUtil } from './util';
import * as debugInstall from './install';
import { PlatformInformation } from './../platform';
import * as semver from 'semver';

const MINIMUM_SUPPORTED_DOTNET_CLI: string = '1.0.0-preview2-003121';

let _reporter: TelemetryReporter = null;
let _channel: vscode.OutputChannel = null;
let _util: CoreClrDebugUtil = null;

class DotnetInfo
{
    public Version: string;
    public OsVersion: string;
    public RuntimeId: string;
}

export function activate(context: vscode.ExtensionContext, reporter: TelemetryReporter) {
    _reporter = reporter;
    _channel = vscode.window.createOutputChannel('coreclr-debug');
    _util = new CoreClrDebugUtil(context.extensionPath, _channel);

    if (CoreClrDebugUtil.existsSync(_util.installCompleteFilePath())) {
        console.log('.NET Core Debugger tools already installed');
        return;
    }

    checkForDotnetTools().then((dotnetInfo: DotnetInfo) => {
        let installer = new debugInstall.DebugInstaller(_util);
        _util.createInstallLog();

        let statusBarMessage = vscode.window.setStatusBarMessage("Downloading and configuring the .NET Core Debugger...");

        let runtimeId: string = '';
        let installStage: string = "installBegin";
        let installError: string = '';
        let moreErrors: string = '';

        getPlatformRuntimeId().then(rid => {
            runtimeId = rid;
        }).then(() => {
            return writeInstallBeginFile();
        }).then(() => {
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
                dotnetVersion: dotnetInfo.Version,
                osVersion: dotnetInfo.OsVersion,
                osRID: dotnetInfo.RuntimeId
            });
            try {
                deleteInstallBeginFile();
            } catch (err) {
                // if this throws there's really nothing we can do
            }
            _util.closeInstallLog();
        });
    }).catch((error) => {
        // log errors from checkForDotnetTools
        _util.log(error.message);
    });
}

// This function checks for the presence of dotnet on the path and ensures the Version
// is new enough for us. Any error UI that needs to be displayed is handled by this function.
// Returns: a promise that returns a DotnetInfo class
// Throws: An Error() from the return promise if either dotnet does not exist or is too old. 
function checkForDotnetTools() : Promise<DotnetInfo>
{
    let dotnetInfo = new DotnetInfo();

    return _util.spawnChildProcess('dotnet', ['--info'], _util.coreClrDebugDir(), (data: Buffer) => {
        let lines: string[] = data.toString().replace(/\r/mg, '').split('\n');
        lines.forEach(line => {
            let match: RegExpMatchArray;
            if (match = /^\ Version:\s*([^\s].*)$/.exec(line)) {
                dotnetInfo.Version = match[1];
            } else if (match = /^\ OS Version:\s*([^\s].*)$/.exec(line)) {
                dotnetInfo.OsVersion = match[1];
            } else if (match = /^\ RID:\s*([\w\-\.]+)$/.exec(line)) {
                dotnetInfo.RuntimeId = match[1];
            }
        });
    }).catch((error) => {
        // something went wrong with spawning 'dotnet --info'
        let message = 'The .NET CLI tools cannot be located. .NET Core debugging will not be enabled. Make sure .NET CLI tools are installed and are on the path.';
        showDotnetToolsWarning(message);
        throw new Error("Failed to spawn 'dotnet --info'");
    }).then(() => {
        // succesfully spawned 'dotnet --info', check the Version
        if (semver.lt(dotnetInfo.Version, MINIMUM_SUPPORTED_DOTNET_CLI))
        {
            let message = 'The .NET CLI tools on the path are too old. .NET Core debugging will not be enabled. The minimum supported version is ' + MINIMUM_SUPPORTED_DOTNET_CLI + '.';
            showDotnetToolsWarning(message);
            throw new Error("dotnet cli is too old");
        }

        return dotnetInfo;
    });
}

function showDotnetToolsWarning(message: string) : void
{
    const config = vscode.workspace.getConfiguration('csharp');
    if (!config.get('suppressDotnetInstallWarning', false)) {
        const getDotNetMessage = 'Get .NET CLI tools';
        const goToSettingsMessage = 'Disable this message in user settings';
        // Buttons are shown in right-to-left order, with a close button to the right of everything;
        // getDotNetMessage will be the first button, then goToSettingsMessage, then the close button.
        vscode.window.showErrorMessage(message,
            goToSettingsMessage, getDotNetMessage).then(value => {
                if (value === getDotNetMessage) {
                    let open = require('open');
                    open('https://www.microsoft.com/net/core');
                } else if (value === goToSettingsMessage) {
                    vscode.commands.executeCommand('workbench.action.openGlobalSettings');
                }
            });
    }
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

function getPlatformRuntimeId(): Promise<string> {
    return PlatformInformation.GetCurrent().then(info => {
        if (info.runtimeId) {
            return info.runtimeId;
        }

        // If we got here, this isn't a support runtime ID.
        const message = `Unsupported platform: ${info.toString()}`
        _util.log(`Error: ${message}`);
        throw new Error(message);
    });
}
