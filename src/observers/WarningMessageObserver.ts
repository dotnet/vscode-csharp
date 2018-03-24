/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import { Scheduler, Subject } from 'rx';
import { BaseEvent, OmnisharpServerOnError, OmnisharpServerMsBuildProjectDiagnostics } from '../omnisharp/loggingEvents';

export interface MessageItemWithCommand extends vscode.MessageItem {
    command: string;
}

export interface ShowWarningMessage<T extends vscode.MessageItem> {
    (message: string, ...items: T[]): Thenable<T | undefined>;
}

export interface ExecuteCommand<T> {
    (command: string, ...rest: any[]): Thenable<T | undefined>;
}

export class WarningMessageObserver {
    private _messageHandle: NodeJS.Timer;
    private warningMessageDebouncer: Subject<BaseEvent>;

    constructor(private showWarningMessage: ShowWarningMessage<MessageItemWithCommand>, private executeCommand: ExecuteCommand<string>, scheduler?: Scheduler) {
        this.warningMessageDebouncer = new Subject<BaseEvent>();
        this.warningMessageDebouncer.debounce(1500, scheduler).subscribe(event => {
            let message = "Some projects have trouble loading. Please review the output for more details.";
            this.showWarningMessage(message, { title: "Show Output", command: 'o.showOutput' }).then(value => {
                if (value) {
                    this.executeCommand(value.command);
                }
            });
        });
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpServerOnError.name:
                this.warningMessageDebouncer.onNext(event);
                break;
            case OmnisharpServerMsBuildProjectDiagnostics.name:
                this.handleOmnisharpServerMsBuildProjectDiagnostics(<OmnisharpServerMsBuildProjectDiagnostics>event);
                break;
        }
    }

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: OmnisharpServerMsBuildProjectDiagnostics) {
        if (event.diagnostics.Errors.length > 0) {
            this.warningMessageDebouncer.onNext(event);
        }
    }
}