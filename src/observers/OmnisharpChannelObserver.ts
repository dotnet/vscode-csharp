/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { Message, MessageType } from "../omnisharp/messageType";
import * as vscode from 'vscodeAdapter';
import { BaseChannelObserver } from "./BaseChannelObserver";

export class OmnisharpChannelObserver extends BaseChannelObserver{ 
    
    constructor(channel: vscode.OutputChannel) {
        super(channel);

    }

    public onNext = (message: Message) => {
        switch (message.type) {
            case MessageType.CommandShowOutput:
                this.channel.show(vscode.ViewColumn.Three);
                break;
            case MessageType.OmnisharpServerOnServerError:
                this.channel.appendLine(message.message);
                break;
            case MessageType.OmnisharpServerOnError:
                if (message.errorMessage.FileName) {
                    this.channel.appendLine(`${message.errorMessage.FileName}(${message.errorMessage.Line},${message.errorMessage.Column})`);
                }
                this.channel.appendLine(message.errorMessage.Text);
                this.channel.appendLine("");
                break;
            case MessageType.OmnisharpServerMsBuildProjectDiagnostics:
                if (message.diagnostics.Errors.length > 0 || message.diagnostics.Warnings.length > 0) {
                    this.channel.appendLine(message.diagnostics.FileName);
                    message.diagnostics.Errors.forEach(error => {
                        this.channel.appendLine(`${error.FileName}(${error.StartLine},${error.StartColumn}): Error: ${error.Text}`);
                    });
                    message.diagnostics.Warnings.forEach(warning => {
                        this.channel.appendLine(`${warning.FileName}(${warning.StartLine},${warning.StartColumn}): Warning: ${warning.Text}`);
                    });
                    this.channel.appendLine("");
                }
                break;
            case MessageType.OmnisharpServerOnStdErr:
                this.channel.append(message.message);
                break;
            case MessageType.OmnisharpFailure:
                this.channel.show();    
        }
    }
}