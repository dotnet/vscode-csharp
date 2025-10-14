/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { languageServerOptions } from './options';
import { RazorLanguage } from '../razor/src/razorLanguage';
import { combineDocumentSelectors } from './utils/combineDocumentSelectors';

export class LimitedActivationStatus {
    static createStatusItem(context: vscode.ExtensionContext) {
        const documentSelector = combineDocumentSelectors(
            languageServerOptions.documentSelector,
            RazorLanguage.documentSelector
        );

        const manageWorkspaceTrust = {
            command: 'workbench.trust.manage',
            title: vscode.l10n.t('Manage'),
        };

        const item = vscode.languages.createLanguageStatusItem('csharp.limitedActivationStatus', documentSelector);
        item.name = vscode.l10n.t('C# Activation Status');
        item.text = vscode.l10n.t('Limited Activation');
        item.detail = vscode.l10n.t('The workspace is not trusted.');
        item.command = manageWorkspaceTrust;
        item.severity = vscode.LanguageStatusSeverity.Error;
        context.subscriptions.push(item);
    }
}
