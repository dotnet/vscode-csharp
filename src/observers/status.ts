/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';

export class Status {

    selector: vscode.DocumentSelector;
    text: string;
    command: string;
    color: string;

    constructor(selector: vscode.DocumentSelector) {
        this.selector = selector;
    }
}

function render(defaultStatus: Status) {
    if (!vscode.window.activeTextEditor) {
        this.hide();
        return;
    }

    let document = vscode.window.activeTextEditor.document;
    let status: Status;

    if (projectStatus && vscode.languages.match(projectStatus.selector, document)) {
        status = projectStatus;
    } else if (defaultStatus.text && vscode.languages.match(defaultStatus.selector, document)) {
        status = defaultStatus;
    }

    if (status) {
        this.text = status.text;
        this.command = status.command;
        this.color = status.color;
        this.show();
        return;
    }

    this.hide();
}
