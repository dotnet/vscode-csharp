/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message, MessageType, OmnisharpEventPacketReceived } from "../omnisharp/messageType";
import { BaseLoggerObserver } from "./BaseLoggerObserver";
import * as os from 'os';

export class OmnisharpDebugModeLoggerObserver extends BaseLoggerObserver {
    public onNext = (message: Message) => {
        switch(message.type){
            case MessageType.OmnisharpRequestMessage:
                this.logger.append(`makeRequest: ${message.request.command} (${message.id})`);
                if (message.request.data) {
                    this.logger.append(`, data=${JSON.stringify(message.request.data)}`);
                }
                this.logger.appendLine();
            break;
        case MessageType.OmnisharpServerEnqueueRequest:
                this.logger.appendLine(`Enqueue ${message.name} request for ${message.command}.`);
                this.logger.appendLine();
            break;
        case MessageType.OmnisharpServerDequeueRequest:
                this.logger.appendLine(`Dequeue ${message.name} request for ${message.command} (${message.id}).`);
                this.logger.appendLine();
            break;
        case MessageType.OmnisharpServerProcessRequestStart:
                this.logger.appendLine(`Processing ${message.name} queue`);
                this.logger.increaseIndent();
            break;
        case MessageType.OmnisharpServerProcessRequestComplete:
                this.logger.decreaseIndent();
            break;
        case MessageType.OmnisharpServerVerboseMessage:
                this.logger.appendLine(message.message);
                this.logger.appendLine();
                break;
            
            //what to do of this ?
        case MessageType.OmnisharpEventPacketReceived:
            if (this._isFilterableOutput(message)) {
                let output = `[${this.getLogLevelPrefix(message.logLevel)}]: ${message.name}${os.EOL}${message.message}`;

                const newLinePlusPadding = os.EOL + "        ";
                output = output.replace(os.EOL, newLinePlusPadding);

                this.logger.appendLine(output);
            }
            break;
        }
        
    }

    private _isFilterableOutput(message: OmnisharpEventPacketReceived) {
        // filter messages like: /codecheck: 200 339ms
        const timing200Pattern = /^\/[\/\w]+: 200 \d+ms/;

        return message.logLevel === "INFORMATION"
            && message.name === "OmniSharp.Middleware.LoggingMiddleware"
            && timing200Pattern.test(message.message);
    }

    private getLogLevelPrefix(logLevel: string) {
        switch (logLevel) {
            case "TRACE": return "trce";
            case "DEBUG": return "dbug";
            case "INFORMATION": return "info";
            case "WARNING": return "warn";
            case "ERROR": return "fail";
            case "CRITICAL": return "crit";
            default: throw new Error(`Unknown log level value: ${logLevel}`);
        }
    }
}