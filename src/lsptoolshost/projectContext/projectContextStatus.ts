/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import { languageServerOptions } from '../../shared/options';
import { RazorLanguage } from '../../razor/src/razorLanguage';
import { ServerState } from '../server/languageServerEvents';
import { combineDocumentSelectors } from '../utils/combineDocumentSelectors';

export class ProjectContextStatus {
    static createStatusItem(context: vscode.ExtensionContext, languageServer: RoslynLanguageServer) {
        const documentSelector = combineDocumentSelectors(
            languageServerOptions.documentSelector,
            RazorLanguage.documentSelector
        );
        const projectContextService = languageServer._projectContextService;

        const item = vscode.languages.createLanguageStatusItem('csharp.projectContextStatus', documentSelector);
        item.name = vscode.l10n.t('C# Project Context Status');
        item.detail = vscode.l10n.t('Active File Context');
        context.subscriptions.push(item);

        projectContextService.onActiveFileContextChanged((e) => {
            item.text = e.context._vs_label;

            // Show a warning when the active file is part of the Miscellaneous File workspace and
            // project initialization is complete.
            if (languageServer.state === ServerState.ProjectInitializationComplete) {
                item.severity =
                    e.context._vs_is_miscellaneous && e.isVerified
                        ? vscode.LanguageStatusSeverity.Warning
                        : vscode.LanguageStatusSeverity.Information;
            } else {
                item.severity = vscode.LanguageStatusSeverity.Information;
            }

            item.detail = e.context._vs_is_miscellaneous
                ? vscode.l10n.t(
                      'The active document is not part of the open workspace. Not all language features will be available.'
                  )
                : vscode.l10n.t('Active File Context');
        });

        // Trigger a refresh, but don't block creation on the refresh completing.
        projectContextService.refresh().catch((e) => {
            throw new Error(`Error refreshing project context status ${e}`);
        });
    }
}
