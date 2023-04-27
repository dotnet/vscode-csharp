/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { State } from 'vscode-languageclient/node';
import { addAssetsIfNecessary, generateAssets } from '../shared/assets';
import { DotnetWorkspaceConfigurationProvider } from '../shared/workspaceConfigurationProvider';
import { IWorkspaceDebugInformationProvider } from '../shared/IWorkspaceDebugInformationProvider';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { RoslynWorkspaceDebugInformationProvider } from './RoslynWorkspaceDebugConfigurationProvider';
import { PlatformInformation } from '../shared/platform';
import OptionProvider from '../shared/observers/OptionProvider';

export function registerDebugger(context: vscode.ExtensionContext, languageServer: RoslynLanguageServer, platformInfo: PlatformInformation, optionProvider: OptionProvider, csharpOutputChannel: vscode.OutputChannel) {
    let workspaceInformationProvider: IWorkspaceDebugInformationProvider = new RoslynWorkspaceDebugInformationProvider(languageServer);

    // TODO - we need to respond to some kind of actual load events for two reasons
    //   - the project might be loaded by the time this calls in
    //   - so we can pop this up again if a different project /sln is loaded.
    let disposable = languageServer.registerOnStateChange(async (state) => {
        if (state.newState === State.Running) {
            // Update or add tasks.json and launch.json
            await addAssetsIfNecessary(context, workspaceInformationProvider);
        }
    });
    context.subscriptions.push(disposable);

    // Register ConfigurationProvider
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('coreclr', new DotnetWorkspaceConfigurationProvider(workspaceInformationProvider, platformInfo, optionProvider, csharpOutputChannel)));
    context.subscriptions.push(vscode.commands.registerCommand('dotnet.generateAssets', async (selectedIndex) => generateAssets(workspaceInformationProvider, selectedIndex)));
}