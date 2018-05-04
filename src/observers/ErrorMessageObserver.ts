/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 
import { BaseEvent, ZipError } from "../omnisharp/loggingEvents";
import { vscode } from "../vscodeAdapter";
 
export class ErrorMessageObserver {

    constructor(private vscode: vscode) {
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case ZipError.name:
                this.handleZipError(<ZipError>event);
                break;
        }
    }

    private async handleZipError(event: ZipError) {
        await showErrorMessage(this.vscode, event.message);
    }
}

async function showErrorMessage(vscode: vscode, message: string, ...items: string[]) {
    try {
        await vscode.window.showErrorMessage(message, ...items);
    }
    catch (err) {
        console.log(err);
    }
}
