/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, vscode } from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerOnError, OmnisharpServerMsBuildProjectDiagnostics } from "../omnisharp/loggingEvents";
import { Scheduler } from 'rxjs/Scheduler';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/debounceTime';

export interface MessageItemWithCommand extends MessageItem {
    command: string;
}

export class WarningMessageObserver {
    private warningMessageDebouncer: Subject<BaseEvent>;

    constructor(private vscode: vscode, private disableMsBuildDiagnosticWarning: () => boolean, scheduler?: Scheduler) {
        this.warningMessageDebouncer = new Subject<BaseEvent>();
        this.warningMessageDebouncer.debounceTime(1500, scheduler).subscribe(async event => {
            let message = "Some projects have trouble loading. Please review the output for more details.";
            await showWarningMessage(this.vscode, message, { title: "Show Output", command: 'o.showOutput' });
        });
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpServerOnError.name:
                this.warningMessageDebouncer.next(event);
                break;
            case OmnisharpServerMsBuildProjectDiagnostics.name:
                this.handleOmnisharpServerMsBuildProjectDiagnostics(<OmnisharpServerMsBuildProjectDiagnostics>event);
                break;
        }
    }

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: OmnisharpServerMsBuildProjectDiagnostics) {
        if (!this.disableMsBuildDiagnosticWarning() && event.diagnostics.Errors.length > 0) {
            this.warningMessageDebouncer.next(event);
        }
    }
}

async function showWarningMessage(vscode: vscode, message: string, ...items: MessageItemWithCommand[]) {
    try {
        let value = await vscode.window.showWarningMessage<MessageItemWithCommand>(message, ...items);
        if (value && value.command) {
            await vscode.commands.executeCommand<string>(value.command);
        }
    }
    catch (err) {
        console.log(err);
    }
}