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

import { PlatformInformation } from './../platform';
import { MessageObserver, MessageType } from '../omnisharp/messageType';

let _debugUtil: CoreClrDebugUtil = null;

export async function activate(thisExtension : vscode.Extension<any>, context: vscode.ExtensionContext, platformInformation: PlatformInformation, sink: MessageObserver) {
    _debugUtil = new CoreClrDebugUtil(context.extensionPath);

    if (!CoreClrDebugUtil.existsSync(_debugUtil.debugAdapterDir())) {
        if (platformInformation) {
            if (platformInformation.architecture !== "x86_64") {
                if (platformInformation.isWindows() && platformInformation.architecture === "x86") {
                    sink.onNext({ 
                        type: MessageType.DebuggerPreRequisiteWarning, 
                        message:  `[WARNING]: x86 Windows is not currently supported by the .NET Core debugger. Debugging will not be available.`
                    });
                } else {
                    sink.onNext({ 
                        type: MessageType.DebuggerPreRequisiteWarning, 
                        message: `[WARNING]: Processor architecture '${platformInformation.architecture}' is not currently supported by the .NET Core debugger. Debugging will not be available.`
                    });
                }
            } else {
                sink.onNext({ 
                    type: MessageType.DebuggerPreRequisiteFailure, 
                    message: "[ERROR]: C# Extension failed to install the debugger package"
                });

                showInstallErrorMessage();
            }
        }
    } else if (!CoreClrDebugUtil.existsSync(_debugUtil.installCompleteFilePath())) {
        completeDebuggerInstall(sink);
    }
}

async function completeDebuggerInstall(sink: MessageObserver) : Promise<boolean> {
    return _debugUtil.checkDotNetCli()
        .then((dotnetInfo: DotnetInfo) => {

            if (os.platform() === "darwin" && !CoreClrDebugUtil.isMacOSSupported()) {
                sink.onNext({ 
                    type: MessageType.DebuggerPreRequisiteFailure, 
                    message: "[ERROR] The debugger cannot be installed. The debugger requires macOS 10.12 (Sierra) or newer." 
                });

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
            sink.onNext({ 
                type: MessageType.DebuggerPreRequisiteWarning, 
                message: err.ErrorString || err
            });
            
            // TODO: log telemetry?

            return false;
        });
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
export async function getAdapterExecutionCommand(sink: MessageObserver): Promise<AdapterExecutableCommand> {
    let util = new CoreClrDebugUtil(common.getExtensionPath());

    // Check for .debugger folder. Handle if it does not exist.
    if (!CoreClrDebugUtil.existsSync(util.debugAdapterDir()))
    {
        // our install.complete file does not exist yet, meaning we have not completed the installation. Try to figure out what if anything the package manager is doing
        // the order in which files are dealt with is this:
        // 1. install.Begin is created
        // 2. install.Lock is created
        // 3. install.Begin is deleted
        // 4. install.complete is created

        // install.Lock does not exist, need to wait for packages to finish downloading.
        let installLock: boolean = await common.installFileExists(common.InstallFileType.Lock);
        if (!installLock) {
            sink.onNext({type: MessageType.DebuggerNotInstalledFailure});
            throw new Error('The C# extension is still downloading packages. Please see progress in the output window below.');
        }
        // install.complete does not exist, check dotnetCLI to see if we can complete.
        else if (!CoreClrDebugUtil.existsSync(util.installCompleteFilePath())) {
            let success: boolean = await completeDebuggerInstall(sink);

            if (!success)
            {
                sink.onNext({type: MessageType.DebuggerNotInstalledFailure});
                throw new Error('Failed to complete the installation of the C# extension. Please see the error in the output window below.');
            }
        }
    }

    // debugger has finished install, kick off our debugger process
    return {
        command: path.join(common.getExtensionPath(), ".debugger", "vsdbg-ui" + CoreClrDebugUtil.getPlatformExeExtension())
    };
}