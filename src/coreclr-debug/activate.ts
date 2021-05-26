/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as common from './../common';
import { CoreClrDebugUtil } from './util';
import { PlatformInformation } from './../platform';
import { DebuggerPrerequisiteWarning, DebuggerPrerequisiteFailure, DebuggerNotInstalledFailure } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import CSharpExtensionExports from '../CSharpExtensionExports';
import { getRuntimeDependencyPackageWithId } from '../tools/RuntimeDependencyPackageUtils';
import { DotnetInfo } from '../utils/getDotnetInfo';
import { DotnetDebugConfigurationProvider } from './debugConfigurationProvider';

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

    const factory = new DebugAdapterExecutableFactory(platformInformation, eventStream, thisExtension.packageJSON, thisExtension.extensionPath);
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', new DotnetDebugConfigurationProvider(platformInformation)));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('clr', new DotnetDebugConfigurationProvider(platformInformation)));
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('coreclr', factory));
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('clr', factory));
}

async function checkForInvalidArchitecture(platformInformation: PlatformInformation, eventStream: EventStream): Promise<boolean> {
    if (platformInformation) {
        if (platformInformation.isMacOS()) {
            if (platformInformation.architecture === "arm64") {
                eventStream.post(new DebuggerPrerequisiteWarning(`[WARNING]: arm64 macOS is not officially supported by the .NET Core debugger. You may experience unexpected issues when running in this configuration.`));
                return false;
            }

            // Validate we are on compatiable macOS version if we are x86_64
            if ((platformInformation.architecture !== "x86_64") ||
                (platformInformation.architecture === "x86_64" && !CoreClrDebugUtil.isMacOSSupported())) {
                eventStream.post(new DebuggerPrerequisiteFailure("[ERROR] The debugger cannot be installed. The debugger requires macOS 10.12 (Sierra) or newer."));
                return true;
            }
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

async function completeDebuggerInstall(platformInformation: PlatformInformation, eventStream: EventStream): Promise<boolean> {
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

function showInstallErrorMessage(eventStream: EventStream) {
    eventStream.post(new DebuggerNotInstalledFailure());
    vscode.window.showErrorMessage("An error occurred during installation of the .NET Core Debugger. The C# extension may need to be reinstalled.");
}

function showDotnetToolsWarning(message: string): void {
    const config = vscode.workspace.getConfiguration('csharp');
    if (!config.get('suppressDotnetInstallWarning', false)) {
        const getDotNetMessage = 'Get the .NET Core SDK';
        const goToSettingsMessage = 'Disable this message in user settings';
        const helpMessage = 'Help';
        // Buttons are shown in right-to-left order, with a close button to the right of everything;
        // getDotNetMessage will be the first button, then goToSettingsMessage, then the close button.
        vscode.window.showErrorMessage(message,
            goToSettingsMessage, getDotNetMessage, helpMessage).then(value => {
                if (value === getDotNetMessage) {
                    let dotnetcoreURL = 'https://dot.net/core-sdk-vscode';
                    vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
                } else if (value === goToSettingsMessage) {
                    vscode.commands.executeCommand('workbench.action.openGlobalSettings');
                } else if (value == helpMessage) {
                    let helpURL = 'https://aka.ms/VSCode-CS-DotnetNotFoundHelp';
                    vscode.env.openExternal(vscode.Uri.parse(helpURL));
                }
            });
    }
}

// The activate method registers this factory to provide DebugAdapterDescriptors
// If the debugger components have not finished downloading, the proxy displays an error message to the user
// Else it will launch the debug adapter
export class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {

    constructor(private readonly platformInfo: PlatformInformation, private readonly eventStream: EventStream, private readonly packageJSON: any, private readonly extensionPath: string) {
    }

    async createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): Promise<vscode.DebugAdapterDescriptor> {
        let util = new CoreClrDebugUtil(common.getExtensionPath());

        // Check for .debugger folder. Handle if it does not exist.
        if (!CoreClrDebugUtil.existsSync(util.debugAdapterDir())) {
            // our install.complete file does not exist yet, meaning we have not completed the installation. Try to figure out what if anything the package manager is doing
            // the order in which files are dealt with is this:
            // 1. install.Begin is created
            // 2. install.Lock is created
            // 3. install.Begin is deleted
            // 4. install.complete is created

            // install.Lock does not exist, need to wait for packages to finish downloading.
            let installLock = false;
            let debuggerPackage = getRuntimeDependencyPackageWithId("Debugger", this.packageJSON, this.platformInfo, this.extensionPath);
            if (debuggerPackage && debuggerPackage.installPath) {
                installLock = await common.installFileExists(debuggerPackage.installPath, common.InstallFileType.Lock);
            }

            if (!installLock) {
                this.eventStream.post(new DebuggerNotInstalledFailure());
                throw new Error('The C# extension is still downloading packages. Please see progress in the output window below.');
            }
            // install.complete does not exist, check dotnetCLI to see if we can complete.
            else if (!CoreClrDebugUtil.existsSync(util.installCompleteFilePath())) {
                let success: boolean = await completeDebuggerInstall(this.platformInfo, this.eventStream);

                if (!success) {
                    this.eventStream.post(new DebuggerNotInstalledFailure());
                    throw new Error('Failed to complete the installation of the C# extension. Please see the error in the output window below.');
                }
            }
        }

        // debugger has finished installation, kick off our debugger process

        // Check for targetArchitecture
        // const targetArchitecture: string = getTargetArchitecture(this.platformInfo, _session.configuration.targetArchitecture, await getDotnetInfo());

        // use the executable specified in the package.json if it exists or determine it based on some other information (e.g. the session)
        if (!executable) {
            const command = path.join(common.getExtensionPath(), ".debugger", "netcoredbg", "netcoredbg" + CoreClrDebugUtil.getPlatformExeExtension());
            executable = new vscode.DebugAdapterExecutable(command, ["--interpreter=vscode"]);
        }

        // make VS Code launch the DA executable
        return executable;
    }
}
