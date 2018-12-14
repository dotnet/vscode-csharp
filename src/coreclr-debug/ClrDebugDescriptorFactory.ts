/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import * as common from './../common';
import { CoreClrDebugUtil } from './util';
import { PlatformInformation } from './../platform';
import { DebuggerNotInstalledFailure } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import { getRuntimeDependencyPackageWithId } from '../tools/RuntimeDependencyPackageUtils';
import { completeDebuggerInstall } from './activate';

export class ClrDebugDescriptorFactory  implements vscode.DebugAdapterDescriptorFactory {
    public static CORECLR_DEBUG_TYPE : string = "coreclr";
    public static CLR_DEBUG_TYPE : string = "clr";

    private platformInfo: PlatformInformation;
    private eventStream: EventStream;
    private packageJSON: any;
    private extensionPath: string;

    constructor(platformInfo: PlatformInformation, eventStream: EventStream, packageJSON: any, extensionPath: string) {
        this.platformInfo = platformInfo;
        this.eventStream = eventStream;
        this.packageJSON = packageJSON;
        this.extensionPath = extensionPath;
    }

    createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        
        return new Promise<void>(async (resolve, reject) => {
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
                if (debuggerPackage && debuggerPackage.installPath)
                {
                    installLock = await common.installFileExists(debuggerPackage.installPath, common.InstallFileType.Lock);
                }
    
                if (!installLock) {
                    this.eventStream.post(new DebuggerNotInstalledFailure());
                    reject(new Error('The C# extension is still downloading packages. Please see progress in the output window below.'));
                }
                // install.complete does not exist, check dotnetCLI to see if we can complete.
                else if (!CoreClrDebugUtil.existsSync(util.installCompleteFilePath())) {
                    let success = await completeDebuggerInstall(this.platformInfo, this.eventStream);

                    if (!success) {
                        this.eventStream.post(new DebuggerNotInstalledFailure());
                        reject(new Error('Failed to complete the installation of the C# extension. Please see the error in the output window below.'));
                    }
                }
            }

            resolve();
        }).then(() => {
            // debugger has finished installation, kick off our debugger process
            return new vscode.DebugAdapterExecutable(path.join(common.getExtensionPath(), ".debugger", "vsdbg-ui" + CoreClrDebugUtil.getPlatformExeExtension()));
        });
    }
}