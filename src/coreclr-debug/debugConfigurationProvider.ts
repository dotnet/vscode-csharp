/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { RemoteAttachPicker, DotNetAttachItemsProviderFactory, AttachPicker, AttachItem } from '../features/processPicker';
import { Options } from '../omnisharp/options';
import { PlatformInformation } from '../platform';
import { hasDotnetDevCertsHttps, createSelfSignedCerts } from '../utils/DotnetDevCertsHttps';
 
export class DotnetDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(public platformInformation: PlatformInformation, private options: Options) {}

    public async resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | null | undefined>
    {
        if (!debugConfiguration)
        {
            return null;
        }

        // Process Id is empty, handle Attach to Process Dialog.
        if (debugConfiguration.request === "attach" && !debugConfiguration.processId && !debugConfiguration.processName)
        {
            let process: AttachItem | undefined;
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

            if (process !== undefined)
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

        if (!this.platformInformation.isLinux() && !vscode.env.remoteName && vscode.env.uiKind != vscode.UIKind.Web) 
        {
            if(debugConfiguration.checkForDevCert === undefined && debugConfiguration.serverReadyAction && !debugConfiguration.pipeTransport)
            {
                debugConfiguration.checkForDevCert = true;
            }

            if (debugConfiguration.checkForDevCert)
            {
                hasDotnetDevCertsHttps(this.options.dotNetCliPaths).then(async (hasDevCert) => {
                    if(!hasDevCert)
                    {
                        const result = await vscode.window.showInformationMessage(
                            "The selected launch configuration is configured to launch a web browser but the certificates required to build and debug are missing from this machine. Add them?", 
                            'Not Now', 'Yes'
                            ); 
                        if (result === 'Yes')
                        {
                            await createSelfSignedCerts(this.options.dotNetCliPaths);
                        }
                    }
                });
            }
        }

        return debugConfiguration;
    }
}
