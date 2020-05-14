/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { debounceTime } from 'rxjs/operators';
import { vscode } from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerMsBuildProjectDiagnostics } from "../omnisharp/loggingEvents";
import { Scheduler, Subject } from 'rxjs';

import showWarningMessage from './utils/ShowWarningMessage';
import { EventType } from '../omnisharp/EventType';

export class WarningMessageObserver {
    private warningMessageDebouncer: Subject<BaseEvent>;

    constructor(private vscode: vscode, private disableMsBuildDiagnosticWarning: () => boolean, scheduler?: Scheduler) {
        this.warningMessageDebouncer = new Subject<BaseEvent>();
        this.warningMessageDebouncer.pipe(debounceTime(1500, scheduler)).subscribe(async event => {
            let message = "Some projects have trouble loading. Please review the output for more details.";
            await showWarningMessage(this.vscode, message, { title: "Show Output", command: 'o.showOutput' });
        });
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerOnError:
                this.warningMessageDebouncer.next(event);
                break;
            case EventType.OmnisharpServerMsBuildProjectDiagnostics:
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