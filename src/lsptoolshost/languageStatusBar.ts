/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { RoslynLanguageServerEvents } from './languageServerEvents';
import { languageServerOptions } from '../shared/options';
import { ServerState } from './serverStateChange';
import { getCSharpDevKit } from '../utils/getCSharpDevKit';

export function registerLanguageStatusItems(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer,
    languageServerEvents: RoslynLanguageServerEvents
) {
    // DevKit will provide an equivalent workspace status item.
    if (!getCSharpDevKit()) {
        WorkspaceStatus.createStatusItem(context, languageServerEvents);
    }
    ProjectContextStatus.createStatusItem(context, languageServer, languageServerEvents);
}

class WorkspaceStatus {
    static createStatusItem(context: vscode.ExtensionContext, languageServerEvents: RoslynLanguageServerEvents) {
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
            item.text = e.workspaceLabel;
            item.busy = e.state === ServerState.ProjectInitializationStarted;
        });
    }
}

class ProjectContextStatus {
    static createStatusItem(
        context: vscode.ExtensionContext,
        languageServer: RoslynLanguageServer,
        languageServerEvents: RoslynLanguageServerEvents
    ) {
        const projectContextService = languageServer._projectContextService;

        const item = vscode.languages.createLanguageStatusItem(
            'csharp.projectContextStatus',
            languageServerOptions.documentSelector
        );
        item.name = vscode.l10n.t('C# Project Context Status');
        item.detail = vscode.l10n.t('Project Context');
        context.subscriptions.push(item);

        updateItem(vscode.window.activeTextEditor);
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateItem));

        languageServerEvents.onServerStateChange((e) => {
            if (e.state === ServerState.ProjectInitializationComplete) {
                projectContextService.clear();
                updateItem(vscode.window.activeTextEditor);
            }
        });

        async function updateItem(e: vscode.TextEditor | undefined) {
            if (e?.document.languageId !== 'csharp') {
                item.text = '';
                return;
            }

            const projectContext = await projectContextService.getCurrentProjectContext(e.document.uri);
            if (projectContext) {
                item.text = projectContext._vs_label;
            }
        }
    }
}
