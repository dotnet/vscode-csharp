/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as common from './../common';

import { CoreClrDebugUtil, DotnetInfo, } from './util';

import { Logger } from './../logger';
import { PlatformInformation } from './../platform';
import TelemetryReporter from 'vscode-extension-telemetry';

let _debugUtil: CoreClrDebugUtil = null;
let _logger: Logger = null;

export async function activate(thisExtension : vscode.Extension<any>, context: vscode.ExtensionContext, reporter: TelemetryReporter, logger: Logger, channel: vscode.OutputChannel) {
    _debugUtil = new CoreClrDebugUtil(context.extensionPath, logger);
    _logger = logger;

    if (!CoreClrDebugUtil.existsSync(_debugUtil.debugAdapterDir())) {
        let platformInformation: PlatformInformation;
        
        try {
            platformInformation = await PlatformInformation.GetCurrent();
        }
        catch (err) {
            // Somehow we couldn't figure out the platform we are on
            logger.appendLine("[ERROR]: C# Extension failed to install the debugger package");
            showInstallErrorMessage(channel);
        }
        
        if (platformInformation) {
            if (platformInformation.architecture !== "x86_64") {
                if (platformInformation.isWindows() && platformInformation.architecture === "x86") {
                    logger.appendLine(`[WARNING]: x86 Windows is not currently supported by the .NET Core debugger. Debugging will not be available.`);
                } else {
                    logger.appendLine(`[WARNING]: Processor architecture '${platformInformation.architecture}' is not currently supported by the .NET Core debugger. Debugging will not be available.`);
                }
            } else {
                logger.appendLine("[ERROR]: C# Extension failed to install the debugger package");
                showInstallErrorMessage(channel);
            }
        }
    } else if (!CoreClrDebugUtil.existsSync(_debugUtil.installCompleteFilePath())) {
        completeDebuggerInstall(logger, channel);
    }
}

async function completeDebuggerInstall(logger: Logger, channel: vscode.OutputChannel) : Promise<boolean> {
    return _debugUtil.checkDotNetCli()
        .then((dotnetInfo: DotnetInfo) => {

            if (os.platform() === "darwin" && !CoreClrDebugUtil.isMacOSSupported()) {
                logger.appendLine("[ERROR] The debugger cannot be installed. The debugger requires macOS 10.12 (Sierra) or newer.");
                channel.show();
                vscode.window.showErrorMessage("The .NET Core debugger cannot be installed. The debugger requires macOS 10.12 (Sierra) or newer.");

                return false;
            }

            // Write install.complete
            CoreClrDebugUtil.writeEmptyFile(_debugUtil.installCompleteFilePath());
            vscode.window.setStatusBarMessage('Successfully installed .NET Core Debugger.', 5000);

            return true;
        }, (err) => {
            // Check for dotnet tools failed. pop the UI
            // err is a DotNetCliError but use defaults in the unexpected case that it's not
            showDotnetToolsWarning(err.ErrorMessage || _debugUtil.defaultDotNetCliErrorMessage());
            _logger.appendLine(err.ErrorString || err);
            // TODO: log telemetry?

            return false;
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

interface AdapterExecutableCommand {
    command: string;
}

// The default extension manifest calls this command as the adapterExecutableCommand
// If the debugger components have not finished downloading, the proxy displays an error message to the user
// Else it will launch the debug adapter
export async function registerAdapterExecutionCommand(channel: vscode.OutputChannel): Promise<AdapterExecutableCommand> {
    let logger = new Logger(text => channel.append(text));
    let util = new CoreClrDebugUtil(common.getExtensionPath(), logger);
    let success = true;

    // our install.complete file does not exist yet, meaning we have not completed the installation. Try to figure out what if anything the package manager is doing
    // the order in which files are dealt with is this:
    // 1. install.Begin is created
    // 2. install.Lock is created
    // 3. install.Begin is deleted
    // 4. install.complete is created

    // install.Lock does not exist, need to wait for packages to finish downloading.
    if (!common.installFileExists(common.InstallFileType.Lock)) {
        success = false;
        vscode.window.showInformationMessage('The omnisharp-csharp extension is still downloading packages. Please see progress in the output window below.');
    }
    // install.complete does not exist, check dotnetCLI to see if we can complete.
    else if (!CoreClrDebugUtil.existsSync(util.installCompleteFilePath())) {
        success = await completeDebuggerInstall(logger, channel);
    }

    if (success)   
    {
        // debugger has finished install and manifest has been rewritten, kick off our debugger process
        return {
            command: path.join(common.getExtensionPath(), ".debugger", "vsdbg-ui" + CoreClrDebugUtil.getPlatformExeExtension())
        };
    }
    else
    {
        return null;
    }
}