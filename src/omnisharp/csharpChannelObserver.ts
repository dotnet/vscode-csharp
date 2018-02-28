/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Message, MessageType } from "./messageType";

export class csharpChannelObserver {
    private channel;

    constructor(channelCreator: () => { show: () => void }) {
        this.channel = channelCreator();
    }

    public onNext(message: Message) {
        switch (message.type) {
            case MessageType.OmnisharpInstallation:
            case MessageType.InstallationFailure:
                this.channel.show();
                break;
        }
    }
}