/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RazorLanguageServerClient } from './razorLanguageServerClient';
import { RazorLogger } from './razorLogger';
import { ActionOption, showInformationMessage } from '../../shared/observers/utils/showMessage';

export function listenToConfigurationChanges(languageServerClient: RazorLanguageServerClient): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(RazorLogger.verbositySetting)) {
            razorTraceConfigurationChangeHandler(languageServerClient);
        }
    });
}

function razorTraceConfigurationChangeHandler(languageServerClient: RazorLanguageServerClient) {
    const promptText: string = vscode.l10n.t(
        'Would you like to restart the Razor Language Server to enable the Razor trace configuration change?'
    );
    const restartButtonText: ActionOption = {
        title: vscode.l10n.t('Restart'),
        action: async () => {
            await languageServerClient.stop();
            languageServerClient.updateTraceLevel();
            await languageServerClient.start();
        },
    };
    showInformationMessage(vscode, promptText, restartButtonText);
}
