/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, ZipError, DotNetTestRunFailure, DotNetTestDebugStartFailure, IntegrityCheckFailure } from "../omnisharp/loggingEvents";
import { vscode } from "../vscodeAdapter";
import showErrorMessage from "./utils/ShowErrorMessage";
import { EventType } from "../omnisharp/EventType";

export class ErrorMessageObserver {
    constructor(private vscode: vscode) {
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ZipError:
                this.handleZipError(<ZipError>event);
                break;
            case EventType.DotNetTestRunFailure:
                this.handleDotnetTestRunFailure(<DotNetTestRunFailure>event);
                break;
            case EventType.DotNetTestDebugStartFailure:
                this.handleDotNetTestDebugStartFailure(<DotNetTestDebugStartFailure>event);
                break;
            case EventType.IntegrityCheckFailure:
                this.handleIntegrityCheckFailure(<IntegrityCheckFailure>event);
        }
    }

    handleIntegrityCheckFailure(event: IntegrityCheckFailure) {
        if (!event.retry) {
            showErrorMessage(this.vscode, `Package ${event.packageDescription} download from ${event.url} failed integrity check. Some features may not work as expected. Please restart Visual Studio Code to retrigger the download`);
        }
    }

    private handleZipError(event: ZipError) {
        showErrorMessage(this.vscode, event.message);
    }

    private handleDotnetTestRunFailure(event: DotNetTestRunFailure) {
        showErrorMessage(this.vscode, `Failed to run test because ${event.message}.`);
    }

    private handleDotNetTestDebugStartFailure(event: DotNetTestDebugStartFailure) {
        showErrorMessage(this.vscode, `Failed to start debugger: ${event.message}`);
    }
}
