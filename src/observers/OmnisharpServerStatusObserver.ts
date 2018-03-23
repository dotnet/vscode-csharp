/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import * as ObservableEvent from "../omnisharp/loggingEvents";

export interface ShowWarningMessage {
    (message: string, options: vscode.MessageOptions, ...items: string[]): Thenable<string | undefined>;
}

export interface ExecuteCommand {
    <T>(command: string, ...rest: any[]): Thenable<T | undefined>;
}

export interface ClearTimeOut {
    (timeoutId: NodeJS.Timer): void;
}

export interface SetTimeOut {
    (callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timer;
}

export class OmnisharpServerStatusObserver {
    private _messageHandle: NodeJS.Timer;

    constructor(private showWarningMessage: ShowWarningMessage, private executeCommand: ExecuteCommand, private clearTimeOut: ClearTimeOut, private setTimeOut : SetTimeOut ) {
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.constructor.name) {
            case ObservableEvent.OmnisharpServerOnError.name:
                this.showMessageSoon();
                break;
            case ObservableEvent.OmnisharpServerMsBuildProjectDiagnostics.name:
                this.handleOmnisharpServerMsBuildProjectDiagnostics(<ObservableEvent.OmnisharpServerMsBuildProjectDiagnostics>event);
                break;
        }
    }

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: ObservableEvent.OmnisharpServerMsBuildProjectDiagnostics) {
        if (event.diagnostics.Errors.length > 0) {
            this.showMessageSoon();
        }
    }

    private showMessageSoon() {
        this.clearTimeOut(this._messageHandle);
        let functionToCall = () => {

            let message = "Some projects have trouble loading. Please review the output for more details.";
            this.showWarningMessage(message, { title: "Show Output", command: 'o.showOutput' }).then(value => {
                if (value) {
                    this.executeCommand(value.command);
                }
            });
        };
        this._messageHandle = this.setTimeOut(functionToCall, 1500);
    }
}