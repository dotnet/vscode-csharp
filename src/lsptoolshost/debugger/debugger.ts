/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { addAssetsIfNecessary, generateAssets } from '../../shared/assets';
import { DotnetWorkspaceConfigurationProvider } from '../../shared/workspaceConfigurationProvider';
import { IWorkspaceDebugInformationProvider } from '../../shared/IWorkspaceDebugInformationProvider';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { RoslynWorkspaceDebugInformationProvider } from '../debugger/roslynWorkspaceDebugConfigurationProvider';
import { PlatformInformation } from '../../shared/platform';
import { DotnetConfigurationResolver } from '../../shared/dotnetConfigurationProvider';
import { getCSharpDevKit } from '../../utils/getCSharpDevKit';
import { RoslynLanguageServerEvents, ServerState } from '../server/languageServerEvents';

export function registerDebugger(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    languageServerEvents: RoslynLanguageServerEvents,
    platformInfo: PlatformInformation,
    csharpOutputChannel: vscode.LogOutputChannel
) {
    const workspaceInformationProvider: IWorkspaceDebugInformationProvider =
        new RoslynWorkspaceDebugInformationProvider(languageServer, csharpOutputChannel);

    const disposable = languageServerEvents.onServerStateChange(async (e) => {
        if (e.state === ServerState.ProjectInitializationComplete) {
            const csharpDevkitExtension = getCSharpDevKit();
            if (!csharpDevkitExtension) {
                // Update or add tasks.json and launch.json
                await addAssetsIfNecessary(context, workspaceInformationProvider);
            }
        }
    });
    context.subscriptions.push(disposable);

    const dotnetWorkspaceConfigurationProvider = new DotnetWorkspaceConfigurationProvider(
        workspaceInformationProvider,
        platformInfo,
        csharpOutputChannel
    );

    // Register ConfigurationProvider
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(
            'dotnet',
            new DotnetConfigurationResolver(workspaceInformationProvider, dotnetWorkspaceConfigurationProvider)
        )
    );
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('coreclr', dotnetWorkspaceConfigurationProvider)
    );

    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('monovsdbg', dotnetWorkspaceConfigurationProvider)
    );

    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('monovsdbg_wasm', dotnetWorkspaceConfigurationProvider)
    );

    vscode.commands.registerCommand(
        'dotnet.generateAssets',
        async (selectedIndex: number, options: { skipPrompt?: boolean } = {}) => {
            if (!(await promptForDevKitDebugConfigurations(options))) {
                return;
            }

            await generateAssets(workspaceInformationProvider, selectedIndex);
        }
    )
}

async function promptForDevKitDebugConfigurations(options: { skipPrompt?: boolean }): Promise<boolean> {
    if (getCSharpDevKit()) {
        // If skipPrompt is true, proceed with generating assets without showing the dialog
        if (options.skipPrompt) {
            return true;
        }

        let result: boolean | undefined = undefined;

        while (result === undefined) {
            const labelYes = vscode.l10n.t('Yes');
            const labelNo = vscode.l10n.t('No');
            const labelMoreInfo = vscode.l10n.t('More Information');
            const title: string = vscode.l10n.t('.NET: Generate Assets for Build and Debug');

            const dialogResult = await vscode.window.showInformationMessage(
                title,
                {
                    modal: true,
                    detail: vscode.l10n.t(
                        `The '{0}' command is not recommended to be used when C# Dev Kit extension is installed. Would you like build and debug using a dynamic configuration instead?`,
                        title
                    ),
                },
                labelYes,
                labelNo,
                labelMoreInfo
            );

            if (dialogResult === labelYes) {
                await vscode.commands.executeCommand('workbench.action.debug.selectandstart', 'dotnet');
                result = false;
            } else if (dialogResult === labelNo) {
                // User cancelled dialog and wishes to continue generating assets.
                result = true;
            } else if (dialogResult === labelMoreInfo) {
                const launchjsonDescriptionURL = 'https://aka.ms/VSCode-CS-DynamicDebugConfig';
                await vscode.env.openExternal(vscode.Uri.parse(launchjsonDescriptionURL));
            } else if (dialogResult === undefined) {
                // Do nothing, user closed the dialog.
                result = false;
            }
        }

        return result;
    }

    return true;
}
