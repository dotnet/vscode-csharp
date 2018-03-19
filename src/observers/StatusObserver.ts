/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerOnError } from "../omnisharp/loggingEvents";

export class DotNetChannelObserver {
    constructor(statusBarItem: vscode.statusBarItem){

    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpServerOnError.name:
                this.render({
                    text: '$(flame) Error starting OmniSharp',
                    command: 'o.showOutput',
                    color: ''
                });
                break;
        }
    }

    private render(defaultStatus: any) {
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

    private text: string;
    private command: string;
    private color: string;

    private show() {

    }

    private hide() {

    }
}