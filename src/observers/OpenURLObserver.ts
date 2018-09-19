/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { BaseEvent, OpenURL } from "../omnisharp/loggingEvents";

export class OpenURLObserver {

    constructor(private vscode: vscode) {
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OpenURL.name:
                let url = (<OpenURL>event).url;
                this.vscode.commands.executeCommand("vscode.open", this.vscode.Uri.parse(url));
                break;
        }
    }
}