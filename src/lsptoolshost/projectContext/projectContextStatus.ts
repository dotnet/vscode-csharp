/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { languageServerOptions } from '../../shared/options';
import { RazorLanguage } from '../../razor/src/razorLanguage';
import { ServerState } from '../server/languageServerEvents';
import { combineDocumentSelectors } from '../../shared/utils/combineDocumentSelectors';

export class ProjectContextStatus {
    static createStatusItem(context: vscode.ExtensionContext, languageServer: RoslynLanguageServer) {
        const documentSelector = combineDocumentSelectors(
            languageServerOptions.documentSelector,
            RazorLanguage.documentSelector
        );
        const projectContextService = languageServer._projectContextService;
        const selectContextCommand = {
            command: 'csharp.changeProjectContext',
            title: vscode.l10n.t('Select context'),
        };
        const item = vscode.languages.createLanguageStatusItem('csharp.projectContextStatus', documentSelector);
        item.name = vscode.l10n.t('C# Project Context Status');
        item.detail = vscode.l10n.t('Active Context');
        context.subscriptions.push(item);

        projectContextService.onActiveFileContextChanged(async (e) => {
            if (e.document !== vscode.window.activeTextEditor?.document) {
                // Only update the status item for the active document.
                return;
            }

            let context = projectContextService.getDocumentContext(e.document.uri);
            if (context === undefined) {
                context = projectContextService.emptyProjectContext;
            }


            item.text = context._vs_label;
            item.command = { ...selectContextCommand, arguments: [e.document] };

            // Show a warning when the active file is part of the Miscellaneous File workspace and
            // project initialization is complete.
            if (languageServer.state === ServerState.ProjectInitializationComplete) {
                item.severity =
                    context._vs_is_miscellaneous && e.isVerified
                        ? vscode.LanguageStatusSeverity.Warning
                        : vscode.LanguageStatusSeverity.Information;
            } else {
                item.severity = vscode.LanguageStatusSeverity.Information;
            }

            item.detail = context._vs_is_miscellaneous
                ? vscode.l10n.t('Not all language features will be available.')
                : vscode.l10n.t('Active Context');
        });

        // Trigger a refresh, but don't block creation on the refresh completing.
        projectContextService.refresh().catch((e) => {
            throw new Error(`Error refreshing project context status ${e}`);
        });
    }
}
