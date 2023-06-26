/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as common from '../common';
import { CoreClrDebugUtil, getTargetArchitecture } from './util';
import { PlatformInformation } from '../shared/platform';
import { DebuggerPrerequisiteWarning, DebuggerPrerequisiteFailure, DebuggerNotInstalledFailure } from '../omnisharp/loggingEvents';
import { EventStream } from '../eventStream';
import { getRuntimeDependencyPackageWithId } from '../tools/runtimeDependencyPackageUtils';
import { getDotnetInfo } from '../utils/getDotnetInfo';
import { Options } from '../shared/options';
import { RemoteAttachPicker } from '../features/processPicker';
import CompositeDisposable from '../compositeDisposable';
import { BaseVsDbgConfigurationProvider } from '../shared/configurationProvider';
import OptionProvider from '../shared/observers/optionProvider';

export async function activate(thisExtension: vscode.Extension<any>, context: vscode.ExtensionContext, platformInformation: PlatformInformation, eventStream: EventStream, csharpOutputChannel: vscode.OutputChannel, optionProvider: OptionProvider) {
    const disposables = new CompositeDisposable();

    const options: Options = optionProvider.GetLatestOptions();
    const debugUtil = new CoreClrDebugUtil(context.extensionPath);

    if (!CoreClrDebugUtil.existsSync(debugUtil.debugAdapterDir())) {
        const isValidArchitecture: boolean = await checkIsValidArchitecture(platformInformation, eventStream);
        // If this is a valid architecture, we should have had a debugger, so warn if we didn't, otherwise
        // a warning was already issued, so do nothing.
        if (isValidArchitecture) {
            eventStream.post(new DebuggerPrerequisiteFailure("[ERROR]: C# Extension failed to install the debugger package."));
            showInstallErrorMessage(eventStream);
        }
    } else if (!CoreClrDebugUtil.existsSync(debugUtil.installCompleteFilePath())) {
        completeDebuggerInstall(debugUtil, platformInformation, eventStream, options);
    }

    // register process picker for attach for legacy configurations.
    disposables.add(vscode.commands.registerCommand('csharp.listProcess', () => ""));
    disposables.add(vscode.commands.registerCommand('csharp.listRemoteProcess', () => ""));

    // List remote processes for docker extension.
    // Change to return "" when https://github.com/microsoft/vscode/issues/110889 is resolved.
    disposables.add(vscode.commands.registerCommand('csharp.listRemoteDockerProcess', async (args) => {
        const attachItem = await RemoteAttachPicker.ShowAttachEntries(args, platformInformation);
        return attachItem ? attachItem.id : Promise.reject<string>(new Error("Could not find a process id to attach."));
    }));

    // Register a command to fire attach to process for the coreclr debug engine.
    disposables.add(vscode.commands.registerCommand('csharp.attachToProcess', async () => {
        vscode.debug.startDebugging(
            undefined,
            {
                "name": ".NET Core Attach",
                "type": "coreclr",
                "request": "attach"
            },
            undefined
        );
    }));

    const factory = new DebugAdapterExecutableFactory(debugUtil, platformInformation, eventStream, thisExtension.packageJSON, thisExtension.extensionPath, options);
    /** 'clr' type does not have a intial configuration provider, but we need to register it to support the common debugger features listed in {@link BaseVsDbgConfigurationProvider} */
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('clr', new BaseVsDbgConfigurationProvider(platformInformation, optionProvider, csharpOutputChannel)));
    disposables.add(vscode.debug.registerDebugAdapterDescriptorFactory('coreclr', factory));
    disposables.add(vscode.debug.registerDebugAdapterDescriptorFactory('clr', factory));

    context.subscriptions.push(disposables);
}

async function checkIsValidArchitecture(platformInformation: PlatformInformation, eventStream: EventStream): Promise<boolean> {
    if (platformInformation) {
        if (platformInformation.isMacOS()) {
            if (platformInformation.architecture === "arm64") {
                return true;
            }

            // Validate we are on compatiable macOS version if we are x86_64
            if ((platformInformation.architecture !== "x86_64") ||
                (platformInformation.architecture === "x86_64" && !CoreClrDebugUtil.isMacOSSupported())) {
                eventStream.post(new DebuggerPrerequisiteFailure("[ERROR] The debugger cannot be installed. The debugger requires macOS 10.12 (Sierra) or newer."));
                return false;
            }

            return true;
        }
        else if (platformInformation.isWindows()) {
            if (platformInformation.architecture === "x86") {
                eventStream.post(new DebuggerPrerequisiteWarning(`[WARNING]: x86 Windows is not supported by the .NET debugger. Debugging will not be available.`));
                return false;
            }

            return true;
        }
        else if (platformInformation.isLinux()) {
            return true;
        }
    }

    eventStream.post(new DebuggerPrerequisiteFailure("[ERROR] The debugger cannot be installed. Unknown platform."));
    return false;
}

async function completeDebuggerInstall(debugUtil: CoreClrDebugUtil, platformInformation: PlatformInformation, eventStream: EventStream, options: Options): Promise<boolean> {
    try {
        await debugUtil.checkDotNetCli(options.omnisharpOptions.dotNetCliPaths);
        const isValidArchitecture = await checkIsValidArchitecture(platformInformation, eventStream);
        if (!isValidArchitecture) {
            eventStream.post(new DebuggerNotInstalledFailure());
            vscode.window.showErrorMessage('Failed to complete the installation of the C# extension. Please see the error in the output window below.');
            return false;
        }

        // Write install.complete
        CoreClrDebugUtil.writeEmptyFile(debugUtil.installCompleteFilePath());

        return true;
    } catch (err) {
        const error = err as Error;

        // Check for dotnet tools failed. pop the UI
        showDotnetToolsWarning(error.message);
        eventStream.post(new DebuggerPrerequisiteWarning(error.message));
        // TODO: log telemetry?
        return false;
    }
}

function showInstallErrorMessage(eventStream: EventStream) {
    eventStream.post(new DebuggerNotInstalledFailure());
    vscode.window.showErrorMessage("An error occurred during installation of the .NET Debugger. The C# extension may need to be reinstalled.");
}

function showDotnetToolsWarning(message: string): void {
    const config = vscode.workspace.getConfiguration('csharp');
    if (!config.get('suppressDotnetInstallWarning', false)) {
        const getDotNetMessage = 'Get the SDK';
        const goToSettingsMessage = 'Disable message in settings';
        const helpMessage = 'Help';
        // Buttons are shown in right-to-left order, with a close button to the right of everything;
        // getDotNetMessage will be the first button, then goToSettingsMessage, then the close button.
        vscode.window.showErrorMessage(message,
            goToSettingsMessage, getDotNetMessage, helpMessage).then(value => {
                if (value === getDotNetMessage) {
                    const dotnetcoreURL = 'https://dot.net/core-sdk-vscode';
                    vscode.env.openExternal(vscode.Uri.parse(dotnetcoreURL));
                } else if (value === goToSettingsMessage) {
                    vscode.commands.executeCommand('workbench.action.openGlobalSettings');
                } else if (value == helpMessage) {
                    const helpURL = 'https://aka.ms/VSCode-CS-DotnetNotFoundHelp';
                    vscode.env.openExternal(vscode.Uri.parse(helpURL));
                }
            });
    }
}

// The activate method registers this factory to provide DebugAdapterDescriptors
// If the debugger components have not finished downloading, the proxy displays an error message to the user
// Else it will launch the debug adapter
export class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {

    constructor(private readonly debugUtil: CoreClrDebugUtil, private readonly platformInfo: PlatformInformation, private readonly eventStream: EventStream, private readonly packageJSON: any, private readonly extensionPath: string, private readonly options: Options) {
    }

    async createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): Promise<vscode.DebugAdapterDescriptor> {
        const util = new CoreClrDebugUtil(common.getExtensionPath());

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
            const debuggerPackage = getRuntimeDependencyPackageWithId("Debugger", this.packageJSON, this.platformInfo, this.extensionPath);
            if (debuggerPackage?.installPath) {
                installLock = await common.installFileExists(debuggerPackage.installPath, common.InstallFileType.Lock);
            }

            if (!installLock) {
                this.eventStream.post(new DebuggerNotInstalledFailure());
                throw new Error('The C# extension is still downloading packages. Please see progress in the output window below.');
            }
            // install.complete does not exist, check dotnetCLI to see if we can complete.
            else if (!CoreClrDebugUtil.existsSync(util.installCompleteFilePath())) {
                const success = await completeDebuggerInstall(this.debugUtil, this.platformInfo, this.eventStream, this.options);
                if (!success) {
                    this.eventStream.post(new DebuggerNotInstalledFailure());
                    throw new Error('Failed to complete the installation of the C# extension. Please see the error in the output window below.');
                }
            }
        }

        // debugger has finished installation, kick off our debugger process

        // use the executable specified in the package.json if it exists or determine it based on some other information (e.g. the session)
        if (!executable) {
            const dotNetInfo = await getDotnetInfo(this.options.omnisharpOptions.dotNetCliPaths);
            const targetArchitecture = getTargetArchitecture(this.platformInfo, _session.configuration.targetArchitecture, dotNetInfo);
            const command = path.join(common.getExtensionPath(), ".debugger", targetArchitecture, "vsdbg-ui" + CoreClrDebugUtil.getPlatformExeExtension());

            // Look to see if DOTNET_ROOT is set, then use dotnet cli path
            const dotnetRoot: string = process.env.DOTNET_ROOT ?? (dotNetInfo.CliPath ? path.dirname(dotNetInfo.CliPath) : '');

            let options: vscode.DebugAdapterExecutableOptions | undefined = undefined;
            if (dotnetRoot) {
                options = {
                    env: {
                        DOTNET_ROOT: dotnetRoot,
                    }
                };
            }

            executable = new vscode.DebugAdapterExecutable(command, [], options);
        }

        // make VS Code launch the DA executable
        return executable;
    }
}

let _brokeredServicePipeName: string | undefined;

/**
 * Initialize brokered service pipe name from C# dev kit, if available.
 * 
 * @param csDevKitPipeName Activated brokered service pipe name activated by {@link CSharpDevKitExports}.
 */
export function initializeBrokeredServicePipeName(csDevKitPipeName: string) {
    _brokeredServicePipeName = csDevKitPipeName;
}

/**
 * Fetch the brokered service pipe name from C# dev kit, if available.
 */
export function getBrokeredServicePipeName(): string | undefined {
    return _brokeredServicePipeName;
}