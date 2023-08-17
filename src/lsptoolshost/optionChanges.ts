/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Observable } from 'rxjs';
import { CommonOptionsThatTriggerReload, LanguageServerOptionsThatTriggerReload, Options } from '../shared/options';
import { HandleOptionChanges, OptionChangeObserver, OptionChanges } from '../shared/observers/optionChangeObserver';
import ShowInformationMessage from '../shared/observers/utils/showInformationMessage';
import Disposable from '../disposable';
import { vscode } from '../vscodeAdapter';

export function registerLanguageServerOptionChanges(optionObservable: Observable<Options>, vscode: vscode): Disposable {
    const optionChangeObserver: OptionChangeObserver = {
        getRelevantOptions: () => {
            return {
                changedCommonOptions: CommonOptionsThatTriggerReload,
                changedLanguageServerOptions: LanguageServerOptionsThatTriggerReload,
                changedOmnisharpOptions: [],
            };
        },
        handleOptionChanges(optionChanges) {
            handleLanguageServerOptionChanges(optionChanges, vscode);
        },
    };

    const disposable = HandleOptionChanges(optionObservable, optionChangeObserver);
    return disposable;
}

function handleLanguageServerOptionChanges(changedOptions: OptionChanges, vscode: vscode): void {
    if (changedOptions.changedCommonOptions.length == 0 && changedOptions.changedLanguageServerOptions.length == 0) {
        // No changes to relevant options, do nothing.
        return;
    }

    const reloadTitle = 'Reload Window';
    const reloadCommand = 'workbench.action.reloadWindow';
    if (changedOptions.changedCommonOptions.find((key) => key === 'useOmnisharpServer')) {
        // If the user has changed the useOmnisharpServer flag we need to reload the window.
        ShowInformationMessage(
            vscode,
            'The useOmnisharpServer option has changed. Please reload the window to apply the change',
            {
                title: reloadTitle,
                command: reloadCommand,
            }
        );
        return;
    }

    // Typically when we have a regular config change, we can just restart the server, but due to
    // https://github.com/dotnet/vscode-csharp/issues/5882 we need to reload the window when using devkit.
    const message = 'C# configuration has changed. Would you like to reload the window to apply your changes?';
    ShowInformationMessage(vscode, message, { title: reloadTitle, command: reloadCommand });
}
