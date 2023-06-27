/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { vscode } from "../../vscodeAdapter";
import { Options } from "../options";
import ShowInformationMessage from "./utils/showInformationMessage";
import { Observable } from "rxjs";
import Disposable from "../../disposable";
import { filter } from 'rxjs/operators';

function OptionChangeObservable(optionObservable: Observable<Options>, shouldOptionChangeTriggerReload: (oldOptions: Options, newOptions: Options) => boolean): Observable<Options> {
    let options: Options;
    return optionObservable.pipe(
        filter(newOptions => {
            const changed = options && shouldOptionChangeTriggerReload(options, newOptions);
            options = newOptions;
            return changed;
        })
    );
}

export function ShowConfigChangePrompt(optionObservable: Observable<Options>, commandName: string, shouldOptionChangeTriggerReload: (oldOptions: Options, newOptions: Options) => boolean, vscode: vscode): Disposable {
    const subscription = OptionChangeObservable(optionObservable, shouldOptionChangeTriggerReload)
        .subscribe(_ => {
            const message = "C# configuration has changed. Would you like to relaunch the Language Server with your changes?";
            ShowInformationMessage(vscode, message, { title: "Restart Language Server", command: commandName });
        });

    return new Disposable(subscription);
}

