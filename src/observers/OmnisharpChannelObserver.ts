/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { Message, MessageType } from "../omnisharp/messageType";
import * as vscode from '../vscodeAdapter';
import { BaseChannelObserver } from "./BaseChannelObserver";

export class OmnisharpChannelObserver extends BaseChannelObserver{
    
    public onNext = (message: Message) => {
        switch (message.type) {
            case MessageType.CommandShowOutput:
                this.showChannel(vscode.ViewColumn.Three);
                break;
            case MessageType.OmnisharpFailure:
                this.showChannel();    
        }
    }
}