/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ObservableEvent from "../omnisharp/loggingEvents";

import { MessageItem, vscode } from '../vscodeAdapter';
import { Scheduler, Subject } from 'rx';

export interface MessageItemWithCommand extends MessageItem{ 
    command: string; 
} 

export class OmnisharpServerStatusObserver {
    private _messageHandle: NodeJS.Timer;
    private subject: Subject<ObservableEvent.BaseEvent>;

    constructor(private vscode: vscode, scheduler?: Scheduler) {
        this.subject = new Subject<ObservableEvent.BaseEvent>();
        this.subject.debounce(1500).subscribe(async (event) => {
            let message = "Some projects have trouble loading. Please review the output for more details.";
            let value = await this.vscode.window.showWarningMessage(message, { title: "Show Output", command: 'o.showOutput' });
            if (value) {
                console.log(value);
                this.vscode.commands.executeCommand(value.command);
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