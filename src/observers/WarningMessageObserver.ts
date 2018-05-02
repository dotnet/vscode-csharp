/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import { MessageItem, vscode } from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerOnError, OmnisharpServerMsBuildProjectDiagnostics, ZipFileError } from "../omnisharp/loggingEvents";
import { Scheduler } from 'rxjs/Scheduler';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/debounceTime';
import { CreateTmpFile } from '../CreateTmpAsset';
import * as vscode1 from 'vscode';

export interface MessageItemWithCommand extends MessageItem {
    command: string;
}

export class WarningMessageObserver {
    private warningMessageDebouncer: Subject<BaseEvent>;

    constructor(private vscode: vscode, private disableMsBuildDiagnosticWarning: () => boolean, scheduler?: Scheduler) {
        this.warningMessageDebouncer = new Subject<BaseEvent>();
        this.warningMessageDebouncer.debounceTime(1500, scheduler).subscribe(async event => {
            let message = "Some projects have trouble loading. Please review the output for more details.";
            let value: MessageItemWithCommand;
            try {
                value = await this.vscode.window.showWarningMessage<MessageItemWithCommand>(message, { title: "Show Output", command: 'o.showOutput' });
                if (value) {
                    await this.vscode.commands.executeCommand<string>(value.command);
                }
            }
            catch (err) {
                console.log(err);
            }
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
            case ZipFileError.name:
                this.handleZipFileError(<ZipFileError>event);
                break;
        }
    }

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: OmnisharpServerMsBuildProjectDiagnostics) {
        if (!this.disableMsBuildDiagnosticWarning() && event.diagnostics.Errors.length > 0) {
            this.warningMessageDebouncer.next(event);
        }
    }

    private async handleZipFileError(event: ZipFileError) {
        let tmpFile = await CreateTmpFile();
        let writestream = fs.createWriteStream(tmpFile.name);
        writestream.write(event.content);
        //once we have written to the file show a warning message to open it
        let value: MessageItemWithCommand;
        let message = " The downloaded file is not a zip. Please review your proxy settings or view the downloaded file below.";
        try {
            //let file = "C:\\Users\\akagarw\\AppData\\Local\\Temp\\package-32592bbSNWBM3SWGP";
            let file = vscode1.Uri.file(tmpFile.name);
            value = await this.vscode.window.showWarningMessage<MessageItemWithCommand>(message, { title: "View downloaded file", command: 'vscode.open' });
            if (value) {
                await this.vscode.commands.executeCommand<string>(value.command,file);
            }
        }
        catch (err) {
            console.log(err);
        }
        finally {
            tmpFile.dispose();
        }
    }
}