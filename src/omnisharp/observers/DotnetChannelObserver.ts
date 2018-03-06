/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Message, MessageType } from "../messageType";

export class DotNetChannelObserver {   
    private channel;

    constructor(channelCreator: () => {
        clear: () => void;
        show: () => void;
        append(value: string): void;
        appendLine(value: string): void;
    }) {
        this.channel = channelCreator();
    }

    public onNext = (message: Message) => {
        switch (message.type) {
            case MessageType.CommandDotNetRestoreStart:
                this.channel.clear();
                this.channel.show();
                break;
            case MessageType.CommandDotNetRestoreProgress:
                this.channel.append(message.message);
                break;
            case MessageType.CommandDotNetRestoreSucceeded:
            case MessageType.CommandDotNetRestoreFailed:
                this.channel.appendLine(message.message);
                break;
        }
    }
}