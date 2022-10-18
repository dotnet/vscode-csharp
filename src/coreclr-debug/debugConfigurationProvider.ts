/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { RemoteAttachPicker, DotNetAttachItemsProviderFactory, AttachPicker, AttachItem } from '../features/processPicker';
import { PlatformInformation } from '../platform';

export class DotnetDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(public platformInformation: PlatformInformation) {}

    public async resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration>
    {
        if (!debugConfiguration)
        {
            return null;
        }

        // Process Id is empty, handle Attach to Process Dialog.
        if (debugConfiguration.request === "attach" && !debugConfiguration.processId && !debugConfiguration.processName)
        {
            let process: AttachItem = undefined;
            if (debugConfiguration.pipeTransport)
            {
                process = await RemoteAttachPicker.ShowAttachEntries(debugConfiguration, this.platformInformation);
            }
            else
            {
                let attachItemsProvider = DotNetAttachItemsProviderFactory.Get();
                let attacher = new AttachPicker(attachItemsProvider);
                process = await attacher.ShowAttachEntries();
            }

            if (process)
            {
                debugConfiguration.processId = process.id;

                if (debugConfiguration.type == "coreclr" && 
                    this.platformInformation.isMacOS() && 
                    this.platformInformation.architecture == 'arm64')
                {
                    // For Apple Silicon M1, it is possible that the process we are attaching to is being emulated as x86_64. 
                    // The process is emulated if it has process flags has P_TRANSLATED (0x20000).
                    if (process.flags & 0x20000)
                    {
                        debugConfiguration.targetArchitecture = "x86_64";
                    }
                    else
                    {
                        debugConfiguration.targetArchitecture = "arm64";
                    }
                }
            }
            else
            {
                vscode.window.showErrorMessage("No process was selected.", { modal: true });
                return undefined;
            }
        }

        return debugConfiguration;
    }
}