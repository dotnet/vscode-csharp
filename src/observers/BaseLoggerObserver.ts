/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import { Logger } from "../logger";
import { BaseEvent } from '../omnisharp/loggingEvents';

export abstract class BaseLoggerObserver {
    public logger: Logger;
    constructor(channel: vscode.OutputChannel) {
        this.logger = new Logger((message) => channel.append(message));
    }
    
    abstract onNext: (event: BaseEvent) => void;
}