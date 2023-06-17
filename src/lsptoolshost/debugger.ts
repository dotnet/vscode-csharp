/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { addAssetsIfNecessary, generateAssets } from '../shared/assets';
import { DotnetWorkspaceConfigurationProvider } from '../shared/workspaceConfigurationProvider';
import { IWorkspaceDebugInformationProvider } from '../shared/IWorkspaceDebugInformationProvider';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { RoslynWorkspaceDebugInformationProvider } from './RoslynWorkspaceDebugConfigurationProvider';
import { PlatformInformation } from '../shared/platform';
import OptionProvider from '../shared/observers/OptionProvider';
import { ServerStateChange } from './ServerStateChange';
import { DotnetConfigurationResolver } from '../shared/dotnetConfigurationProvider';
import { getCSharpDevKit } from '../utils/getCSharpDevKit';

export function registerDebugger(context: vscode.ExtensionContext, languageServer: RoslynLanguageServer, platformInfo: PlatformInformation, optionProvider: OptionProvider, csharpOutputChannel: vscode.OutputChannel) {
    const workspaceInformationProvider: IWorkspaceDebugInformationProvider = new RoslynWorkspaceDebugInformationProvider(languageServer);

    const disposable = languageServer.registerStateChangeEvent(async (state) => {
        if (state === ServerStateChange.ProjectInitializationComplete) {
            const csharpDevkitExtension = getCSharpDevKit();
            if (!csharpDevkitExtension) {
                // Update or add tasks.json and launch.json
                await addAssetsIfNecessary(context, workspaceInformationProvider);
            }
        }
    });
    context.subscriptions.push(disposable);

    // Register ConfigurationProvider
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('dotnet', new DotnetConfigurationResolver(workspaceInformationProvider)));
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', new DotnetWorkspaceConfigurationProvider(workspaceInformationProvider, platformInfo, optionProvider, csharpOutputChannel)));
    context.subscriptions.push(vscode.commands.registerCommand('dotnet.generateAssets', async (selectedIndex) => generateAssets(workspaceInformationProvider, selectedIndex)));
}