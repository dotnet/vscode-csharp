/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { HandleOptionChanges, OptionChangeObserver } from '../shared/observers/optionChangeObserver';
import { CommonOptionsThatTriggerReload, OmnisharpOptionsThatTriggerReload } from '../shared/options';
import ShowInformationMessage from '../shared/observers/utils/showInformationMessage';
import { Observable } from 'rxjs';
import Disposable from '../disposable';

export function registerOmnisharpOptionChanges(optionObservable: Observable<void>): Disposable {
    const optionChangeObserver: OptionChangeObserver = {
        getRelevantOptions: () => {
            return {
                changedCommonOptions: CommonOptionsThatTriggerReload,
                changedLanguageServerOptions: [],
                changedOmnisharpOptions: OmnisharpOptionsThatTriggerReload,
            };
        },
        handleOptionChanges(changedOptions) {
            if (changedOptions.changedCommonOptions.find((key) => key === 'useOmnisharpServer')) {
                // If the user has changed the useOmnisharpServer flag we need to reload the window.
                ShowInformationMessage(
                    vscode,
                    vscode.l10n.t(
                        'dotnet.server.useOmnisharp option has changed. Please reload the window to apply the change'
                    ),
                    {
                        title: vscode.l10n.t('Reload Window'),
                        command: 'workbench.action.reloadWindow',
                    }
                );
                return;
            }

            const message = vscode.l10n.t(
                'C# configuration has changed. Would you like to relaunch the Language Server with your changes?'
            );
            const title = vscode.l10n.t('Restart Language Server');
            const commandName = 'o.restart';
            ShowInformationMessage(vscode, message, { title: title, command: commandName });
        },
    };

    const disposable = HandleOptionChanges(optionObservable, optionChangeObserver);
    return disposable;
}
