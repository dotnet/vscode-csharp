/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, vscode } from '../vscodeAdapter';
import { Scheduler, Subject } from 'rx';
import { BaseEvent, OmnisharpServerOnError, OmnisharpServerMsBuildProjectDiagnostics } from "../omnisharp/loggingEvents";

export interface MessageItemWithCommand extends MessageItem {
    command: string;
}

export class WarningMessageObserver {
    private warningMessageDebouncer: Subject<BaseEvent>;

    constructor(private vscode: vscode, scheduler?: Scheduler) {
        this.warningMessageDebouncer = new Subject<BaseEvent>();
        this.warningMessageDebouncer.debounce(1500, scheduler).subscribe(async event => {
            let message = "Some projects have trouble loading. Please review the output for more details.";
            let value = await this.vscode.window.showWarningMessage<MessageItemWithCommand>(message, { title: "Show Output", command: 'o.showOutput' });
            if (value) {
                await this.vscode.commands.executeCommand<string>(value.command);
            }
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