/*--------------------------------------------------------------------------------------------- 
 *  Copyright (c) Microsoft Corporation. All rights reserved. 
 *  Licensed under the MIT License. See License.txt in the project root for license information. 
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { Options } from "../omnisharp/options";
import ShowInformationMessage from "./utils/ShowInformationMessage";
import { Observable } from "rxjs/Observable";
import Disposable from "../Disposable";
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/distinctUntilChanged';

function ConfigChangeObservable(optionObservable: Observable<Options>): Observable<Options> {
    let options: Options;
    return optionObservable. filter(newOptions => {
        let changed = (options && hasChanged(options, newOptions));
        options = newOptions;
        return changed;
    });
}

export function ShowOmniSharpConfigChangePrompt(optionObservable: Observable<Options>, vscode: vscode) {
    let subscription = ConfigChangeObservable(optionObservable)
        .subscribe(_ => {
            let message = "OmniSharp configuration has changed. Would you like to relaunch the OmniSharp server with your changes?";
            ShowInformationMessage(vscode, message, { title: "Restart Now", command: 'o.restart' });
        });

    return new Disposable(subscription);
}

function hasChanged(oldOptions: Options, newOptions: Options): boolean {
    if (oldOptions.path != newOptions.path ||
        oldOptions.useGlobalMono != newOptions.useGlobalMono ||
        oldOptions.waitForDebugger != newOptions.waitForDebugger) {

        return true;
    }

    return false;
}