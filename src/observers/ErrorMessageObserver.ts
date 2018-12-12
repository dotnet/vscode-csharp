/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, ZipError, DotNetTestRunFailure, DotNetTestDebugStartFailure, CorruptedDownloadError } from "../omnisharp/loggingEvents";
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
            case DotNetTestRunFailure.name:
                this.handleDotnetTestRunFailure(<DotNetTestRunFailure>event);
                break;
            case DotNetTestDebugStartFailure.name:
                this.handleDotNetTestDebugStartFailure(<DotNetTestDebugStartFailure>event);
                break;
            case CorruptedDownloadError.name:
                this.handleCorruptedDownloadError(<CorruptedDownloadError> event);
        }
    }

    handleCorruptedDownloadError(event: CorruptedDownloadError): any {
        showErrorMessage(this.vscode, `There was a problem downloading ${event.packageDescription}. Some functionalities may not work as expected. Please restart vscode to retrigger the download or download the package manually from ${event.url}`);
    }

    private handleZipError(event: ZipError) {
        showErrorMessage(this.vscode, event.message);
    }

    private handleDotnetTestRunFailure(event: DotNetTestRunFailure) {
        showErrorMessage(this.vscode,`Failed to run test because ${event.message}.`);
    }

    private handleDotNetTestDebugStartFailure(event: DotNetTestDebugStartFailure) {
        showErrorMessage(this.vscode, `Failed to start debugger: ${event.message}`);
    }
}
