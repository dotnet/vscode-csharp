/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { Message, MessageType } from "./messageType";
import * as vscode from 'vscode';

export class OmnisharpChannelObserver {
    private channel;

    constructor(channelCreator: () => { show: () => void }) {
        this.channel = channelCreator();
    }

    public onNext(message: Message) {
        switch (message.type) {
            case MessageType.CommandShowOutput:
                this.channel.show(vscode.ViewColumn.Three);
                break;
        }
    }
}