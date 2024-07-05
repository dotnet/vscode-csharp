/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { RoslynLanguageServerEvents } from './languageServerEvents';
import { languageServerOptions } from '../shared/options';
import { ServerStateChange } from './serverStateChange';
import { getCSharpDevKit } from '../utils/getCSharpDevKit';

export function registerLanguageStatusItems(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    languageServerEvents: RoslynLanguageServerEvents
) {
    // DevKit will provide an equivalent workspace status item.
    if (!getCSharpDevKit()) {
        WorkspaceStatus.createStatusItem(context, languageServer, languageServerEvents);
    }
}

class WorkspaceStatus {
    static createStatusItem(
        context: vscode.ExtensionContext,
        languageServer: RoslynLanguageServer,
        languageServerEvents: RoslynLanguageServerEvents
    ) {
        const item = vscode.languages.createLanguageStatusItem(
            'csharp.workspaceStatus',
            languageServerOptions.documentSelector
        );
        item.name = vscode.l10n.t('C# Workspace Status');
        item.command = {
            command: 'dotnet.openSolution',
            title: vscode.l10n.t('Open solution'),
        };
        context.subscriptions.push(item);

        languageServerEvents.onServerStateChange((e) => {
            if (e === ServerStateChange.ProjectInitializationStarted) {
                item.text = languageServer.workspaceDisplayName();
                item.busy = true;
            } else if (e === ServerStateChange.ProjectInitializationComplete) {
                item.text = languageServer.workspaceDisplayName();
                item.busy = false;
            }
        });
    }
}
