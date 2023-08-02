/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { RazorLanguageServerClient } from './razorLanguageServerClient';
import { RazorLogger } from './razorLogger';

export function listenToConfigurationChanges(languageServerClient: RazorLanguageServerClient): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(RazorLogger.verbositySetting)) {
            razorTraceConfigurationChangeHandler(languageServerClient);
        }
    });
}

function razorTraceConfigurationChangeHandler(languageServerClient: RazorLanguageServerClient) {
    const promptText: string = l10n.t(
        'Would you like to restart the Razor Language Server to enable the Razor trace configuration change?'
    );
    const restartButtonText = l10n.t('Restart');

    vscode.window.showInformationMessage(promptText, restartButtonText).then(async (result) => {
        if (result !== restartButtonText) {
            return;
        }

        await languageServerClient.stop();
        languageServerClient.updateTraceLevel();
        await languageServerClient.start();
    });
}
