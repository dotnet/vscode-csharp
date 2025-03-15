/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServerEvents, ServerState } from '../server/languageServerEvents';
import { combineDocumentSelectors } from '../utils/combineDocumentSelectors';
import { languageServerOptions } from '../../shared/options';

export class WorkspaceStatus {
    static createStatusItem(context: vscode.ExtensionContext, languageServerEvents: RoslynLanguageServerEvents) {
        const documentSelector = combineDocumentSelectors(languageServerOptions.documentSelector);
        const openSolutionCommand = {
            command: 'dotnet.openSolution',
            title: vscode.l10n.t('Open solution'),
        };
        const restartServerCommand = {
            command: 'dotnet.restartServer',
            title: vscode.l10n.t('Restart server'),
        };

        const item = vscode.languages.createLanguageStatusItem('csharp.workspaceStatus', documentSelector);
        item.name = vscode.l10n.t('C# Workspace Status');
        item.severity = vscode.LanguageStatusSeverity.Error;
        item.command = openSolutionCommand;
        context.subscriptions.push(item);

        languageServerEvents.onServerStateChange((e) => {
            item.text = e.workspaceLabel;
            item.busy = e.state === ServerState.ProjectInitializationStarted;
            item.severity =
                e.state === ServerState.Stopped
                    ? vscode.LanguageStatusSeverity.Error
                    : vscode.LanguageStatusSeverity.Information;
            item.command = e.state === ServerState.Stopped ? restartServerCommand : openSolutionCommand;
        });
    }
}
