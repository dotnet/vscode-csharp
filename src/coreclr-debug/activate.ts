/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import TelemetryReporter from 'vscode-extension-telemetry';
import { CoreClrDebugUtil, DotnetInfo, DotNetCliError } from './util';
import * as debugInstall from './install';
import * as path from 'path';
import { Logger } from './../logger'

let _debugUtil: CoreClrDebugUtil = null;
let _reporter: TelemetryReporter = null;
let _logger: Logger = null;

export function activate(context: vscode.ExtensionContext, reporter: TelemetryReporter, logger: Logger) {
    _debugUtil = new CoreClrDebugUtil(context.extensionPath, logger);
    _reporter = reporter;
    _logger = logger;

    if (!CoreClrDebugUtil.existsSync(_debugUtil.debugAdapterDir())) {
        // We have been activated but it looks like our package was not installed. This is bad.
        logger.appendLine("[ERROR]: C# Extension failed to install the debugger package");
        showInstallErrorMessage();
    } else if (!CoreClrDebugUtil.existsSync(_debugUtil.installCompleteFilePath())) {
        _debugUtil.checkDotNetCli()
            .then((dotnetInfo: DotnetInfo) => {
                let installer = new debugInstall.DebugInstaller(_debugUtil);
                installer.finishInstall()
                    .then(() => {
                        vscode.window.setStatusBarMessage('Successfully installed .NET Core Debugger.');
                    })
                    .catch((err) => {
                        logger.appendLine("[ERROR]: An error occured while installing the .NET Core Debugger:")
                        logger.appendLine(err);
                        showInstallErrorMessage();
                        // TODO: log telemetry?
                    });
            }, (err) => {
                // Check for dotnet tools failed. pop the UI
                // err is a DotNetCliError but use defaults in the unexpected case that it's not
                showDotnetToolsWarning(err.ErrorMessage || _debugUtil.defaultDotNetCliErrorMessage());
                _logger.appendLine(err.ErrorString || err);
                // TODO: log telemetry?
            });
    }
}

function showInstallErrorMessage() {
    vscode.window.showErrorMessage("An error occured during installation of the .NET Core Debugger. The C# extension may need to be reinstalled.");
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