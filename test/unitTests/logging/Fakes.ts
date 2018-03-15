/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../../../src/vscodeAdapter';
import { ITelemetryReporter } from '../../../src/observers/TelemetryObserver';

export const getNullChannel = (): vscode.OutputChannel => {
    let returnChannel: vscode.OutputChannel = {
        name: "",
        append: (value: string) => { },
        appendLine: (value: string) => { },
        clear: () => { },
        show: (preserveFocusOrColumn?: boolean | vscode.ViewColumn, preserveFocus?: boolean) => { },
        hide: () => { },
        dispose: () => { }
    };
    return returnChannel;
};

export const getNullTelemetryReporter = (): ITelemetryReporter => {
    let reporter: ITelemetryReporter = {
        sendTelemetryEvent: (eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }) => { }
    };

    return reporter;
};