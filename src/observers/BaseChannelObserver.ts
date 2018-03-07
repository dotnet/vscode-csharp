/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Message } from "../omnisharp/messageType";
import * as vscode from 'vscodeAdapter';

export abstract class BaseChannelObserver {
    channel: vscode.OutputChannel;

    constructor(channel: vscode.OutputChannel) {
        this.channel = channel;
    }

    abstract onNext: (message: Message) => void;
}