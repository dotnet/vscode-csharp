/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { DotNetAttachItemsProviderFactory, AttachPicker, AttachItem } from '../features/processPicker';
import { PlatformInformation } from '../platform';

export class CoreCLRConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(public platformInformation: PlatformInformation) {}

    public async resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration>
    {
        if (!debugConfiguration)
        {
            return null;
        }

        // Process Id is empty, handle Attach to Process Dialog.
        if (debugConfiguration.request === "attach" && !debugConfiguration.processId)
        {
            let attachItemsProvider = DotNetAttachItemsProviderFactory.Get();
            let attacher = new AttachPicker(attachItemsProvider);
            const process: AttachItem = await attacher.SelectProcess();

            if (process)
            {
                debugConfiguration.processId = process.id;
                if (this.platformInformation.isMacOS() && this.platformInformation.architecture == 'arm64')
                {
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
                throw new Error("No process was selected.");
            }
        }

        return debugConfiguration;
    }
}