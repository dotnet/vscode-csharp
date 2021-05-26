/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { Options } from "../omnisharp/options";
import ShowInformationMessage from "./utils/ShowInformationMessage";
import { Observable } from "rxjs";
import Disposable from "../Disposable";
import { filter } from 'rxjs/operators';

type OptionsKey = keyof Options;

const omniSharpOptions: ReadonlyArray<OptionsKey> = [
    "path",
    "useGlobalMono",
    "enableMsBuildLoadProjectsOnDemand",
    "waitForDebugger",
    "loggingLevel",
    "enableEditorConfigSupport",
    "enableDecompilationSupport",
    "enableImportCompletion",
    "organizeImportsOnFormat",
    "enableAsyncCompletion",
];

function OmniSharpOptionChangeObservable(optionObservable: Observable<Options>): Observable<Options> {
    let options: Options;
    return optionObservable.pipe(
        filter(newOptions => {
            const changed = options && omniSharpOptions.some(key => options[key] !== newOptions[key]);
            options = newOptions;
            return changed;
        })
    );
}

export function ShowOmniSharpConfigChangePrompt(optionObservable: Observable<Options>, vscode: vscode): Disposable {
    const subscription = OmniSharpOptionChangeObservable(optionObservable)
        .subscribe(_ => {
            let message = "OmniSharp configuration has changed. Would you like to relaunch the OmniSharp server with your changes?";
            ShowInformationMessage(vscode, message, { title: "Restart OmniSharp", command: 'o.restart' });
        });

    return new Disposable(subscription);
}
