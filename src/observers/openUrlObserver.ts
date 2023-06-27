/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode } from '../vscodeAdapter';
import { BaseEvent, OpenURL } from '../omnisharp/loggingEvents';
import { EventType } from '../omnisharp/eventType';

export class OpenURLObserver {
    constructor(private vscode: vscode) {}

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OpenURL:
                this.vscode.env.openExternal(this.vscode.Uri.parse((<OpenURL>event).url));
                break;
        }
    };
}
