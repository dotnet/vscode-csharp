/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import * as ObservableEvent from "../omnisharp/loggingEvents";
import { Scheduler, Subject } from 'rx';

export interface MessageItemWithCommand extends vscode.MessageItem{
    command: string;
}

export interface ShowWarningMessage<T extends vscode.MessageItem> {
    (message: string, ...items: T[]): Thenable<T | undefined>;
}

export interface ExecuteCommand<T> {
    (command: string, ...rest: any[]): Thenable<T | undefined>;
}

export class OmnisharpServerStatusObserver {
    private _messageHandle: NodeJS.Timer;
    private subject: Subject<ObservableEvent.BaseEvent>;

    constructor(private showWarningMessage: ShowWarningMessage<MessageItemWithCommand>, private executeCommand: ExecuteCommand<string>, scheduler?: Scheduler) {
        this.subject = new Subject<ObservableEvent.BaseEvent>();
        this.subject.debounce(1500).subscribe(async (event) => {
            let message = "Some projects have trouble loading. Please review the output for more details.";
            let value = await this.showWarningMessage(message, { title: "Show Output", command: 'o.showOutput' });
            if (value) {
                console.log(value);
                this.executeCommand(value.command);
            }
        });
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.constructor.name) {
            case ObservableEvent.OmnisharpServerOnError.name:
                this.subject.onNext(event);
                break;
            case ObservableEvent.OmnisharpServerMsBuildProjectDiagnostics.name:
                this.handleOmnisharpServerMsBuildProjectDiagnostics(<ObservableEvent.OmnisharpServerMsBuildProjectDiagnostics>event);
                break;
        }
    }

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: ObservableEvent.OmnisharpServerMsBuildProjectDiagnostics) {
        if (event.diagnostics.Errors.length > 0) {
            //this.showMessageSoon();
            this.subject.onNext(event);
        }
    }
}