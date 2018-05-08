/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerOnError, OmnisharpServerMsBuildProjectDiagnostics } from "../omnisharp/loggingEvents";
import { Scheduler } from 'rxjs/Scheduler';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/debounceTime';
import { Options } from '../omnisharp/options';
import showWarningMessage from './ShowWarningMessage';
import { Observable } from 'rxjs/Observable';

export class WarningMessageObserver {
    private warningMessageDebouncer: Subject<BaseEvent>;
    private options: Options;

    constructor(private vscode: vscode, optionStream: Observable<Options>,private scheduler?: Scheduler) {
        this.warningMessageDebouncer = new Subject<BaseEvent>();
        optionStream.subscribe(options => this.options = options);
        this.setupDebounceHandler();
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
        if (this.options && !this.options.disableMSBuildDiagnosticWarning && event.diagnostics.Errors.length > 0) {
            this.warningMessageDebouncer.next(event);
        }
    }

    private setupDebounceHandler() {
        this.setupOmnisharpErrorHandler();
    }

    private setupOmnisharpErrorHandler() {
        this.warningMessageDebouncer.filter(event => ((event instanceof OmnisharpServerOnError) || (event instanceof OmnisharpServerMsBuildProjectDiagnostics)))
            .debounceTime(1500, this.scheduler)
            .subscribe(async event => {
                let message = "Some projects have trouble loading. Please review the output for more details.";
                await showWarningMessage(this.vscode, message, { title: "Show Output", command: 'o.showOutput' });
            });
    }
}