/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { RemoteAttachPicker, DotNetAttachItemsProviderFactory, AttachPicker, AttachItem } from '../features/processPicker';
import { Options } from '../omnisharp/options';
import { PlatformInformation } from '../platform';
import { hasDotnetDevCertsHttps, createSelfSignedCert, CertToolStatusCodes } from '../utils/DotnetDevCertsHttps';
import { EventStream } from '../EventStream';
import { DevCertCreationFailure, ShowChannel } from '../omnisharp/loggingEvents';
import * as fs from 'fs-extra';
import path = require('path');

export class DotnetDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(public platformInformation: PlatformInformation, private readonly eventStream: EventStream, private options: Options) {}

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
        
        // We want to ask the user if we should run dotnet  dev-certs https --trust, but this doesn't work in a few cases --
        // Linux -- not supported by the .NET CLI as there isn't a single root cert store
        // VS Code remoting/Web UI -- the trusted cert work would need to happen on the client machine, but we don't have a way to run code there currently
        // pipeTransport -- the dev cert on the server will be different from the client
        if (!this.platformInformation.isLinux() && !vscode.env.remoteName && vscode.env.uiKind != vscode.UIKind.Web && !debugConfiguration.pipeTransport)
        {
            if(debugConfiguration.checkForDevCert === undefined && debugConfiguration.serverReadyAction)
            {
                debugConfiguration.checkForDevCert = true;
            }

            if (debugConfiguration.checkForDevCert)
            {
                checkForDevCerts(this.options.dotNetCliPaths, this.eventStream);
            }
        }

        // If launchSettings.json contains an https launch profile, and no launchSettingsProfile is specified in the debug configuration, use https as default.
        // otherwise dotnet would have used the first profile it found where commandName === "Project"
        // This doesn't apply to Linux as it is not supported by the .NET CLI
        if (!this.platformInformation.isLinux() && debugConfiguration.launchSettingsProfile === undefined)
        {
            const projectDirectory = folder?.uri.fsPath;
            const launchSettingsPath = debugConfiguration.launchSettingsFilePath ?? path.join(projectDirectory ?? debugConfiguration.cwd, 'Properties', 'launchSettings.json');

            try {
                if (fs.pathExistsSync(launchSettingsPath)) {
                    const launchSettingsObj = fs.readJsonSync(launchSettingsPath);
                    if (launchSettingsObj?.hasOwnProperty('profiles'))
                    {
                        let profileNames = Object.keys(launchSettingsObj.profiles);
                        for (let profileName of profileNames){
                            if (ProfileHasHttpsUrlAndIsProject(launchSettingsObj.profiles[profileName]))
                            {
                                debugConfiguration.launchSettingsProfile = profileName; // Use the first https profile found
                                break; 
                            }
                        }
                    }                   
                }
            } catch {
                // Swallow IO errors from reading the launchSettings.json file
            }
        }

        return debugConfiguration;
    }
}

function checkForDevCerts(dotNetCliPaths: string[], eventStream: EventStream)
{
    hasDotnetDevCertsHttps(dotNetCliPaths).then(async (returnData) => {
        let errorCode = returnData.error?.code;
        if(errorCode === CertToolStatusCodes.CertificateNotTrusted || errorCode === CertToolStatusCodes.ErrorNoValidCertificateFound) 
        {
            const labelYes: string = "Yes";
            const labelNotNow: string = "Not Now";
            const labelMoreInfo: string = "More Information";

            const result = await vscode.window.showInformationMessage(
                "The selected launch configuration is configured to launch a web browser but no trusted development certificate was found. Create a trusted self-signed certificate?", 
                { title:labelYes }, { title:labelNotNow, isCloseAffordance: true }, { title:labelMoreInfo }
                ); 
            if (result?.title === labelYes)
            {
                let returnData = await createSelfSignedCert(dotNetCliPaths);
                if (returnData.error === null) //if the prcess returns 0, returnData.error is null, otherwise the return code can be acessed in returnData.error.code
                {
                    let message = errorCode === CertToolStatusCodes.CertificateNotTrusted ? 'trusted' : 'created';
                    vscode.window.showInformationMessage(`Self-signed certificate sucessfully ${message}.`);
                }
                else
                {
                    eventStream.post(new DevCertCreationFailure(`${returnData.error.message}\ncode: ${returnData.error.code}\nstdout: ${returnData.stdout}`));

                    const labelShowOutput: string = "Show Output";
                    const result = await vscode.window.showWarningMessage("Couldn't create self-signed certificate. See output for more information.", labelShowOutput);
                    if (result === labelShowOutput){
                        eventStream.post(new ShowChannel());
                    }
                }
            }
            if (result?.title === labelMoreInfo)
            {
                const launchjsonDescriptionURL = 'https://github.com/OmniSharp/omnisharp-vscode/blob/master/debugger-launchjson.md#check-for-devcert';
                vscode.env.openExternal(vscode.Uri.parse(launchjsonDescriptionURL));
                checkForDevCerts(dotNetCliPaths, eventStream);
            }
        }
    });
}

function ProfileHasHttpsUrlAndIsProject(profile: any): Boolean
{
    if(profile?.commandName !== "Project") { return false; }

    let urls = profile.applicationUrl?.split(';');
    if (urls !== null && urls.length > 0) 
    {  
        return urls.find((url : string) => 
            url.startsWith("https://")
        ) !== undefined;
    }
    return false;
}
