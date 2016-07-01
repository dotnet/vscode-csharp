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
    
    if (!isOnPath('dotnet')) {
        const getDotNetMessage = "Get .NET CLI tools"; 
        vscode.window.showErrorMessage("The .NET CLI tools cannot be located. .NET Core debugging will not be enabled. Make sure .NET CLI tools are installed and are on the path.",
            getDotNetMessage).then(value => {
                if (value === getDotNetMessage) {
                    let open = require('open');
                    open("http://dotnet.github.io/getting-started/");
                }
            });

        return;
    }

    let installer = new debugInstall.DebugInstaller(_util);
    _util.createInstallLog();

    let runtimeId = getPlatformRuntimeId();

    let statusBarMessage = vscode.window.setStatusBarMessage("Downloading and configuring the .NET Core Debugger...");

    let installStage = "installBegin";
    let installError = "";

    writeInstallBeginFile().then(() => {
        return installer.install(runtimeId);
    }).then(() => {
        installStage = "completeSuccess";
        statusBarMessage.dispose();
        vscode.window.setStatusBarMessage('Successfully installed .NET Core Debugger.');
    })
    .catch((error: debugInstall.InstallError) => {
        const viewLogMessage = "View Log";
        vscode.window.showErrorMessage('Error while installing .NET Core Debugger.', viewLogMessage).then(value => {
            if (value === viewLogMessage) {
                _channel.show(vscode.ViewColumn.Three);
            }
        });
        statusBarMessage.dispose();

        installStage = error.installStage;
        installError = error.installError;
    }).then(() => {
        // log telemetry and delete install begin file
        logTelemetry('Acquisition', {installStage: installStage, installError: installError});
        try {
            deleteInstallBeginFile();
        } catch (err) {
            // if this throws there's really nothing we can do
        }
        _util.closeInstallLog();
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

// Determines if the specified command is in one of the directories in the PATH environment variable.
function isOnPath(command : string) : boolean {
    let pathValue = process.env['PATH'];
    if (!pathValue) {
        return false;
    }
    let fileName = command;
    if (process.platform == 'win32') {
        // on Windows, add a '.exe', and the path is semi-colon seperatode
        fileName = fileName + ".exe";
    }

    let pathSegments: string[] = pathValue.split(path.delimiter);
    for (let segment of pathSegments) {
        if (segment.length === 0 || !path.isAbsolute(segment)) {
            continue;
        }

        const segmentPath = path.join(segment, fileName);

        try {
            if (CoreClrDebugUtil.existsSync(segmentPath)) {
                return true;
            }
        } catch (err) {
            // any error from existsSync can be treated as the command not being on the path
            continue;
        }
    }

    return false;
}

function getPlatformRuntimeId() : string {
    switch (process.platform) {
        case 'win32':
            return 'win7-x64';
        case 'darwin':
            return 'osx.10.11-x64';
        case 'linux':
            return getDotnetRuntimeId();
        default:
            _util.log('Error: Unsupported platform ' + process.platform);
            throw Error('Unsupported platform ' + process.platform);
    }
}
    
function getDotnetRuntimeId(): string {
    _util.log("Starting 'dotnet --info'");

    const cliVersionErrorMessage = "Ensure that .NET Core CLI Tools version >= 1.0.0-beta-002173 is installed. Run 'dotnet --version' to see what version is installed.";

    let child = child_process.spawnSync('dotnet', ['--info'], { cwd: _util.coreClrDebugDir() });

    if (child.stderr.length > 0) {
        _util.log('Error: ' + child.stderr.toString());
    }
    const out = child.stdout.toString();
    if (out.length > 0) {
        _util.log(out);
    }

    if (child.status !== 0) {
        const message = `Error: 'dotnet --info' failed with error ${child.status}`;
        _util.log(message);
        _util.log(cliVersionErrorMessage);
        throw new Error(message);
    }

    if (out.length === 0) {
        const message = "Error: 'dotnet --info' provided no output";
        _util.log(message);
        _util.log(cliVersionErrorMessage);
        throw new Error(message);
    }

    let lines = out.split('\n');
    let ridLine = lines.filter(value => {
        return value.trim().startsWith('RID:');
    });

    if (ridLine.length < 1) {
        _util.log("Error: Cannot find 'RID' property");
        _util.log(cliVersionErrorMessage);
        throw new Error('Cannot obtain Runtime ID from dotnet cli');
    }

    let rid = ridLine[0].split(':')[1].trim();

    if (!rid) {
        _util.log("Error: Unable to parse 'RID' property.");
        _util.log(cliVersionErrorMessage);
        throw new Error('Unable to determine Runtime ID');
    }

    return rid;
}
