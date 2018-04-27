/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import { BaseEvent } from '../omnisharp/loggingEvents';

export abstract class BaseChannelObserver {

    constructor(private channel: vscode.OutputChannel) {
    }

    abstract post: (event: BaseEvent) => void;

    public showChannel(preserveFocusOrColumn?: boolean) {
        this.channel.show(preserveFocusOrColumn);
    }

    public clearChannel() {
        this.channel.clear();
    }
}