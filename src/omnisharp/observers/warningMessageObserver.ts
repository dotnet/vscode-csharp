/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { debounceTime } from 'rxjs/operators';
import { vscode } from '../../vscodeAdapter.js';
import { BaseEvent } from '../../shared/loggingEvents.js';
import { OmnisharpServerMsBuildProjectDiagnostics } from '../omnisharpLoggingEvents.js';
import { Scheduler, Subject } from 'rxjs';

import { EventType } from '../../shared/eventType.js';
import { l10n } from 'vscode';
import { CommandOption, showWarningMessage } from '../../shared/observers/utils/showMessage.js';

export class WarningMessageObserver {
    private warningMessageDebouncer: Subject<BaseEvent>;

    constructor(
        private vscode: vscode,
        private disableMsBuildDiagnosticWarning: () => boolean,
        scheduler?: Scheduler
    ) {
        this.warningMessageDebouncer = new Subject<BaseEvent>();
        this.warningMessageDebouncer.pipe(debounceTime(1500, scheduler)).subscribe((_) => {
            const message = l10n.t('Some projects have trouble loading. Please review the output for more details.');
            const buttonTitle: CommandOption = {
                title: l10n.t('Show Output'),
                command: 'o.showOutput',
            };
            showWarningMessage(this.vscode, message, buttonTitle);
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
    };

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: OmnisharpServerMsBuildProjectDiagnostics) {
        if (!this.disableMsBuildDiagnosticWarning() && event.diagnostics.Errors.length > 0) {
            this.warningMessageDebouncer.next(event);
        }
    }
}
