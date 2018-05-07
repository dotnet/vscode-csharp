/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem, vscode } from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerOnError, OmnisharpServerMsBuildProjectDiagnostics, WorkspaceConfigurationChanged } from "../omnisharp/loggingEvents";
import { Scheduler } from 'rxjs/Scheduler';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/debounceTime';
import { Options } from '../omnisharp/options';

export interface MessageItemWithCommand extends MessageItem {
    command: string;
}

export class WarningMessageObserver {
    private warningMessageDebouncer: Subject<BaseEvent>;
    private options: Options;

    constructor(private vscode: vscode, scheduler?: Scheduler) {
        this.options = this.readOmniSharpOptions();
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
            case WorkspaceConfigurationChanged.name:
                this.handleWorkspaceConfigurationChanged();
                break;
        }
    }

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: OmnisharpServerMsBuildProjectDiagnostics) {
        let options = this.readOmniSharpOptions();
        if (!options.disableMSBuildDiagnosticWarning  && event.diagnostics.Errors.length > 0) {
            this.warningMessageDebouncer.next(event);
        }
    }

    private async handleWorkspaceConfigurationChanged() {
        let newOptions = this.readOmniSharpOptions();
        if (JSON.stringify(newOptions) != JSON.stringify(this.options)) {
            let message = "OmniSharp configuration has changed. Would you like to relaunch the OmniSharp server with your changes?";
            await showWarningMessage(this.vscode, message, { title: "Restart Now", command: 'o.restart' });
            this.options = newOptions;
        }
    }

    private readOmniSharpOptions() {
        return Options.Read(this.vscode);
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