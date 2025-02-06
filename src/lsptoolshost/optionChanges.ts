/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Observable } from 'rxjs';
import { CommonOptionsThatTriggerReload, LanguageServerOptionsThatTriggerReload } from '../shared/options';
import { HandleOptionChanges, OptionChangeObserver, OptionChanges } from '../shared/observers/optionChangeObserver';
import Disposable from '../disposable';
import { CommandOption, showInformationMessage } from '../shared/observers/utils/showMessage';

export function registerLanguageServerOptionChanges(optionObservable: Observable<void>): Disposable {
    const optionChangeObserver: OptionChangeObserver = {
        getRelevantOptions: () => {
            return {
                changedCommonOptions: CommonOptionsThatTriggerReload,
                changedLanguageServerOptions: LanguageServerOptionsThatTriggerReload,
                changedOmnisharpOptions: [],
            };
        },
        handleOptionChanges(optionChanges) {
            handleLanguageServerOptionChanges(optionChanges);
        },
    };

    const disposable = HandleOptionChanges(optionObservable, optionChangeObserver);
    return disposable;
}

function handleLanguageServerOptionChanges(changedOptions: OptionChanges): void {
    if (changedOptions.changedCommonOptions.length == 0 && changedOptions.changedLanguageServerOptions.length == 0) {
        // No changes to relevant options, do nothing.
        return;
    }

    const reloadTitle: CommandOption = {
        title: vscode.l10n.t('Reload Window'),
        command: 'workbench.action.reloadWindow',
    };
    if (changedOptions.changedCommonOptions.find((key) => key === 'useOmnisharpServer')) {
        // If the user has changed the useOmnisharpServer flag we need to reload the window.
        showInformationMessage(
            vscode,
            vscode.l10n.t(
                'dotnet.server.useOmnisharp option has changed. Please reload the window to apply the change'
            ),
            reloadTitle
        );
        return;
    }

    // Typically when we have a regular config change, we can just restart the server, but due to
    // https://github.com/dotnet/vscode-csharp/issues/5882 we need to reload the window when using devkit.
    const message = vscode.l10n.t(
        'C# configuration has changed. Would you like to reload the window to apply your changes?'
    );
    showInformationMessage(vscode, message, reloadTitle);
}
