/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { CoreClrDebugUtil, DotnetInfo, } from './util';
import * as debugInstall from './install';
import { Logger } from './../logger';
import { VSCodePlatformInformation } from './../vscodePlatform';
import { CSharpExtDownloader } from './../CSharpExtDownloader';

let _debugUtil: CoreClrDebugUtil = null;
let _reporter: TelemetryReporter = null;
let _logger: Logger = null;

export function activate(thisExtension : vscode.Extension<any>, context: vscode.ExtensionContext, reporter: TelemetryReporter, logger: Logger, channel: vscode.OutputChannel) {
    _debugUtil = new CoreClrDebugUtil(context.extensionPath, logger);
    _reporter = reporter;
    _logger = logger;

    if (!CoreClrDebugUtil.existsSync(_debugUtil.debugAdapterDir())) {
        VSCodePlatformInformation.GetCurrent().then((info) => {
            if (info.runtimeId) {
                if (info.runtimeId === 'win7-x86') {
                    logger.appendLine(`[WARNING]: x86 Windows is not currently supported by the .NET Core debugger. Debugging will not be available.`);
                } else if (info.isLinux() && VSCodePlatformInformation.isFallbackDebuggerLinuxRuntimeIdSet()) {
                    // The user set the fallback runtime id after the initial extension install, retry again now
                    const downloader = new CSharpExtDownloader(channel, logger, null, thisExtension.packageJSON);
                    downloader.installRuntimeDependencies().then((success : boolean) => {
                        if (success) {
                            completeDebuggerInstall(logger, channel);       
                        }
                    });
                } else {
                    logger.appendLine("[ERROR]: C# Extension failed to install the debugger package");
                    showInstallErrorMessage(channel);
                }
            } else {
                if (info.isLinux) { 
                    if (info.distribution.name === 'arch') {
                        logger.appendLine("[WARNING]: The .NET Core debugger could not be automatically installed. Follow instructions on https://aka.ms/vscode-csext-arch to enable debugging on Arch Linux.");
                    } else {
                        logger.appendLine(`[WARNING]: The current Linux distribution '${info.distribution.name}' version '${info.distribution.version}' is not currently supported by the .NET Core debugger. Debugging will not be available.`);
                        logger.appendLine(`If '${info.distribution.name}' is binary compatible with a Linux distribution officially supported by .NET Core, you may be able to resolve this by setting 'csharp.fallbackDebuggerLinuxRuntimeId' in 'File->Preferences->Settings' and restarting VS Code.`);
                    }
                } else {
                    logger.appendLine(`[WARNING]: The current operating system is not currently supported by the .NET Core debugger. Debugging will not be available.`);
                }
            }
        }, (err) => {
            // Somehow we couldn't figure out the platform we are on
            logger.appendLine("[ERROR]: C# Extension failed to install the debugger package");
            showInstallErrorMessage(channel);
        });
    } else if (!CoreClrDebugUtil.existsSync(_debugUtil.installCompleteFilePath())) {
        completeDebuggerInstall(logger, channel);
    }
}

function completeDebuggerInstall(logger: Logger, channel: vscode.OutputChannel) : void {
    _debugUtil.checkDotNetCli()
        .then((dotnetInfo: DotnetInfo) => {
            _debugUtil.checkOpenSSLInstalledIfRequired().then((isInstalled) => {
                if (isInstalled) {
                    let installer = new debugInstall.DebugInstaller(_debugUtil);
                    installer.finishInstall()
                        .then(() => {
                            vscode.window.setStatusBarMessage('Successfully installed .NET Core Debugger.', 5000);
                        })
                        .catch((err) => {
                            logger.appendLine("[ERROR]: An error occured while installing the .NET Core Debugger:");
                            logger.appendLine(err);
                            showInstallErrorMessage(channel);
                            // TODO: log telemetry?
                        });
                } else {
                    logger.appendLine("[ERROR] The debugger cannot be installed. A required component, OpenSSL, is not correctly configured.");
                    logger.appendLine("In order to use the debugger, open a terminal window and execute the following instructions.");
                    logger.appendLine("See https://www.microsoft.com/net/core#macos for more details.");
                    logger.appendLine();
                    logger.appendLine("  brew update");
                    logger.appendLine("  brew install openssl");
                    logger.appendLine("  mkdir -p /usr/local/lib");
                    logger.appendLine("  ln -s /usr/local/opt/openssl/lib/libcrypto.1.0.0.dylib /usr/local/lib/");
                    logger.appendLine("  ln -s /usr/local/opt/openssl/lib/libssl.1.0.0.dylib /usr/local/lib/");
                    channel.show();
                    vscode.window.showErrorMessage("The .NET Core debugger cannot be installed. OpenSSL is not correctly configured. See the C# output channel for details.");
                }
            });
        }, (err) => {
            // Check for dotnet tools failed. pop the UI
            // err is a DotNetCliError but use defaults in the unexpected case that it's not
            showDotnetToolsWarning(err.ErrorMessage || _debugUtil.defaultDotNetCliErrorMessage());
            _logger.appendLine(err.ErrorString || err);
            // TODO: log telemetry?
        });
}

function showInstallErrorMessage(channel: vscode.OutputChannel) {
    channel.show();
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
                    let dotnetcoreURL = 'https://www.microsoft.com/net/core';

                    // Windows redirects https://www.microsoft.com/net/core to https://www.microsoft.com/net/core#windowsvs2015
                    if (process.platform == "win32")
                    {
                        dotnetcoreURL = dotnetcoreURL + '#windowscmd';
                    }

                    open(dotnetcoreURL);
                } else if (value === goToSettingsMessage) {
                    vscode.commands.executeCommand('workbench.action.openGlobalSettings');
                }
            });
    }
}
