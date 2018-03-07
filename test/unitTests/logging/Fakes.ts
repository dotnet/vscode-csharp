/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscodeAdapter';

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