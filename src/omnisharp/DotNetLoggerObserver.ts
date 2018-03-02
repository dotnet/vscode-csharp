/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message, MessageType } from "./messageType";

import { Logger } from "../logger";

export class DotNetLoggerObserver {
    private logger;

    constructor(loggerCreator: () => Logger) {
        this.logger = loggerCreator();
    }

    public onNext(message: Message) {
        switch (message.type) {
            case MessageType.CommandDotNetRestoreProgress:
            case MessageType.CommandDotNetRestoreSucceeded:
            case MessageType.CommandDotNetRestoreFailed:
                    this.logger.append(message.message);
                    break;
        }
    }
}