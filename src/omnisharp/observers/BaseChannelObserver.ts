/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Message } from "../messageType";
import { ViewColumn } from "vscode";

export interface ChannelAdapter {
    clear: () => void;
    show: (column?: ViewColumn, preserveFocus?: boolean) => void;
    append: (value: string) => void;
    appendLine: (value: string) => void;
}

export abstract class BaseChannelObserver {
    channel: ChannelAdapter;

    constructor(channelFactory: () => ChannelAdapter) {
        this.channel = channelFactory();
    }
    
    abstract onNext: (message: Message) => void;
}