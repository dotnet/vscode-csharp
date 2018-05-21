/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, ZipError, DotnetTestRunFailure, DebuggerStartFailure } from "../omnisharp/loggingEvents";
import { vscode } from "../vscodeAdapter";
import showErrorMessage from "./utils/ShowErrorMessage";

export class ErrorMessageObserver {

    constructor(private vscode: vscode) {
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case ZipError.name:
                this.handleZipError(<ZipError>event);
                break;
            case DotnetTestRunFailure.name:
                this.handleDotnetTestRunFailure(<DotnetTestRunFailure>event);
                break;
            case DebuggerStartFailure.name:
                this.handleDebuggerStartFailure(<DebuggerStartFailure>event);
                break;
        }
    }

    private handleZipError(event: ZipError) {
        showErrorMessage(this.vscode, event.message);
    }

    private handleDotnetTestRunFailure(event: DotnetTestRunFailure) {
        showErrorMessage(this.vscode,`Failed to run test because ${event.message}.`);
    }

    private handleDebuggerStartFailure(event: DebuggerStartFailure) {
        showErrorMessage(this.vscode, `Failed to start debugger: ${event.message}`);
    }
}
