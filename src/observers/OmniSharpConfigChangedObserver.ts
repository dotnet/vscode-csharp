/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from '../vscodeAdapter';
import 'rxjs/add/operator/debounceTime';
import { Options } from '../omnisharp/options';
import showWarningMessage from './ShowWarningMessage';

let options: Options;

export async function WorkspaceConfigurationChangedHandle(vscode: vscode, newOptions: Options) {
    if (options != null) {
        if (options.path != newOptions.path
            || options.useGlobalMono != newOptions.useGlobalMono
            || options.waitForDebugger != newOptions.waitForDebugger
            || options.projectLoadTimeout != newOptions.projectLoadTimeout) {
            let message = "OmniSharp configuration has changed. Would you like to relaunch the OmniSharp server with your changes?";
            await showWarningMessage(vscode, message, { title: "Restart Now", command: 'o.restart' });
        }
    }

    options = newOptions;
}


