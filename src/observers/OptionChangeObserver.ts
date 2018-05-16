/*--------------------------------------------------------------------------------------------- 
 *  Copyright (c) Microsoft Corporation. All rights reserved. 
 *  Licensed under the MIT License. See License.txt in the project root for license information. 
 *--------------------------------------------------------------------------------------------*/

import OptionStream from "../observables/OptionStream";
import { vscode } from "../vscodeAdapter";
import { Options } from "../omnisharp/options";
import ShowInformationMessage from "./utils/ShowInformationMessage";

export function ShowOmniSharpConfigHasChanged(optionStream: OptionStream, vscode: vscode) {
    let options: Options;
    return optionStream.subscribe(newOptions => {
        if (options && hasChanged(options, newOptions)) {
            let message = "OmniSharp configuration has changed. Would you like to relaunch the OmniSharp server with your changes?";
            ShowInformationMessage(vscode, message, { title: "Restart Now", command: 'o.restart' });
        }

        options = newOptions;
    });
}

function hasChanged(oldOptions: Options, newOptions: Options): boolean {
    if (oldOptions.path != newOptions.path ||
        oldOptions.useGlobalMono != newOptions.useGlobalMono ||
        oldOptions.waitForDebugger != newOptions.waitForDebugger) {

        return true;
    }

    return false;
}