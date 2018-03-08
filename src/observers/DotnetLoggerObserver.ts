/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BaseLoggerObserver } from "./BaseLoggerObserver";
import { Message, MessageType } from "../omnisharp/messageType";

export class DotnetLoggerObserver extends BaseLoggerObserver {
    public onNext = (message: Message) => {
        switch(message.type){
            case MessageType.CommandDotNetRestoreProgress:
                this.logger.append(message.message);
                break;
            case MessageType.CommandDotNetRestoreSucceeded:
            case MessageType.CommandDotNetRestoreFailed:
                this.logger.appendLine(message.message);
                break;
        }
    }
}