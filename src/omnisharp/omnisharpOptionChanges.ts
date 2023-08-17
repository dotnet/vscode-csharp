/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { HandleOptionChanges, OptionChangeObserver } from '../shared/observers/optionChangeObserver';
import { CommonOptionsThatTriggerReload, OmnisharpOptionsThatTriggerReload, Options } from '../shared/options';
import ShowInformationMessage from '../shared/observers/utils/showInformationMessage';
import { vscode } from '../vscodeAdapter';
import { Observable } from 'rxjs';
import Disposable from '../disposable';

export function registerOmnisharpOptionChanges(vscode: vscode, optionObservable: Observable<Options>): Disposable {
    const optionChangeObserver: OptionChangeObserver = {
        getRelevantOptions: () => {
            return {
                changedCommonOptions: CommonOptionsThatTriggerReload,
                changedLanguageServerOptions: [],
                changedOmnisharpOptions: OmnisharpOptionsThatTriggerReload,
            };
        },
        handleOptionChanges(_) {
            const message =
                'C# configuration has changed. Would you like to relaunch the Language Server with your changes?';
            const title = 'Restart Language Server';
            const commandName = 'o.restart';
            ShowInformationMessage(vscode, message, { title: title, command: commandName });
        },
    };

    const disposable = HandleOptionChanges(optionObservable, optionChangeObserver);
    return disposable;
}
