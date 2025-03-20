/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import * as vscode from 'vscode';
import { registerCopilotContextProviders } from './contextProviders';
import { registerCopilotRelatedFilesProvider } from './relatedFilesProvider';

export function registerCopilotExtensions(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    copilotPluginPath: string | undefined,
    channel: vscode.LogOutputChannel
) {
    const ext = vscode.extensions.getExtension('github.copilot');
    if (!ext) {
        channel.debug('GitHub Copilot extension not installed. Skip registeration of Copilot related functionalities.');
        return;
    }

    ext.activate().then(async (copilotExt) => {
        if (copilotPluginPath) {
            try {
                await registerCopilotContextProviders(copilotExt, context, languageServer, channel);
            } catch (error) {
                channel.error('Failed to register Copilot context providers', error);
            }
        }

        try {
            await registerCopilotRelatedFilesProvider(copilotExt, context, languageServer, channel);
        } catch (error) {
            channel.error('Failed to register Copilot context providers', error);
        }
    });
}
