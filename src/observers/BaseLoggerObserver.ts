/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message } from "../omnisharp/messageType";
import * as vscode from 'vscodeAdapter';
import { Logger } from "../logger";

export abstract class BaseLoggerObserver {
    public logger: Logger;
    constructor(channel: vscode.OutputChannel) {
        this.logger = new Logger((message) => channel.append(message));
    }
    
    abstract onNext: (message: Message) => void;
}