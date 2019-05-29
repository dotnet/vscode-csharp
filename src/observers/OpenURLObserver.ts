/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from "../vscodeAdapter";
import { BaseEvent, OpenURL } from "../omnisharp/loggingEvents";
import { EventType } from "../omnisharp/EventType";

export class OpenURLObserver {

    constructor(private vscode: vscode) {
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OpenURL:
                let url = (<OpenURL>event).url;
                this.vscode.env.openExternal(this.vscode.Uri.parse(url));
                break;
        }
    }
}