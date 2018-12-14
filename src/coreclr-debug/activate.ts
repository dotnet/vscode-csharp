/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CoreClrDebugUtil, DotnetInfo, } from './util';
import { PlatformInformation } from './../platform';
import { DebuggerPrerequisiteWarning, DebuggerPrerequisiteFailure, DebuggerNotInstalledFailure } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import CSharpExtensionExports from '../CSharpExtensionExports';

let _debugUtil: CoreClrDebugUtil = null;

export async function activate(thisExtension: vscode.Extension<CSharpExtensionExports>, context: vscode.ExtensionContext, platformInformation: PlatformInformation, eventStream: EventStream) {
    _debugUtil = new CoreClrDebugUtil(context.extensionPath);

    if (!CoreClrDebugUtil.existsSync(_debugUtil.debugAdapterDir())) {
        let isInvalidArchitecture: boolean = await checkForInvalidArchitecture(platformInformation, eventStream);
        if (!isInvalidArchitecture) {
            eventStream.post(new DebuggerPrerequisiteFailure("[ERROR]: C# Extension failed to install the debugger package."));
            showInstallErrorMessage(eventStream);
        }
    } else if (!CoreClrDebugUtil.existsSync(_debugUtil.installCompleteFilePath())) {
        completeDebuggerInstall(platformInformation, eventStream);
    }
}

async function checkForInvalidArchitecture(platformInformation: PlatformInformation, eventStream: EventStream): Promise<boolean> {
    if (platformInformation) {
        if (platformInformation.isMacOS() && !CoreClrDebugUtil.isMacOSSupported()) {
            eventStream.post(new DebuggerPrerequisiteFailure("[ERROR] The debugger cannot be installed. The debugger requires macOS 10.12 (Sierra) or newer."));
            return true;
        }
        else if (platformInformation.architecture !== "x86_64") {
            if (platformInformation.isWindows() && platformInformation.architecture === "x86") {
                eventStream.post(new DebuggerPrerequisiteWarning(`[WARNING]: x86 Windows is not currently supported by the .NET Core debugger. Debugging will not be available.`));
            } else {
                eventStream.post(new DebuggerPrerequisiteWarning(`[WARNING]: Processor architecture '${platformInformation.architecture}' is not currently supported by the .NET Core debugger. Debugging will not be available.`));
            }
            return true;
        }
    }

    return false;
}

export async function completeDebuggerInstall(platformInformation: PlatformInformation, eventStream: EventStream): Promise<boolean> {
    return _debugUtil.checkDotNetCli()
        .then(async (dotnetInfo: DotnetInfo) => {

            let isInvalidArchitecture: boolean = await checkForInvalidArchitecture(platformInformation, eventStream);

            if (isInvalidArchitecture) {
                eventStream.post(new DebuggerNotInstalledFailure());
                vscode.window.showErrorMessage('Failed to complete the installation of the C# extension. Please see the error in the output window below.');
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
            eventStream.post(new DebuggerPrerequisiteWarning(err.ErrorString || err));
            // TODO: log telemetry?
            return false;
        });
}

function showInstallErrorMessage(eventStream : EventStream) {
    eventStream.post(new DebuggerNotInstalledFailure());
    vscode.window.showErrorMessage("An error occured during installation of the .NET Core Debugger. The C# extension may need to be reinstalled.");
}

function showDotnetToolsWarning(message: string): void {
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
                    if (process.platform == "win32") {
                        dotnetcoreURL = dotnetcoreURL + '#windowscmd';
                    }

                    open(dotnetcoreURL);
                } else if (value === goToSettingsMessage) {
                    vscode.commands.executeCommand('workbench.action.openGlobalSettings');
                }
            });
    }
}