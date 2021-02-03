/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseLoggerObserver } from "./BaseLoggerObserver";
import * as os from 'os';
import { BaseEvent, OmnisharpRequestMessage, OmnisharpServerEnqueueRequest, OmnisharpServerDequeueRequest, OmnisharpServerRequestCancelled, OmnisharpServerVerboseMessage, OmnisharpServerProcessRequestStart, OmnisharpEventPacketReceived } from "../omnisharp/loggingEvents";
import { EventType } from "../omnisharp/EventType";

export class OmnisharpDebugModeLoggerObserver extends BaseLoggerObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpRequestMessage:
                this.handleOmnisharpRequestMessage(<OmnisharpRequestMessage>event);
                break;
            case EventType.OmnisharpServerEnqueueRequest:
                this.handleOmnisharpServerEnqueueRequest(<OmnisharpServerEnqueueRequest>event);
                break;
            case EventType.OmnisharpServerDequeueRequest:
                this.handleOmnisharpServerDequeueRequest(<OmnisharpServerDequeueRequest>event);
                break;
            case EventType.OmnisharpServerRequestCancelled:
                this.handleOmnisharpServerRequestCancelled(<OmnisharpServerRequestCancelled>event);
                break;
            case EventType.OmnisharpServerProcessRequestStart:
                this.handleOmnisharpProcessRequestStart(<OmnisharpServerProcessRequestStart>event);
                break;
            case EventType.OmnisharpServerProcessRequestComplete:
                this.logger.decreaseIndent();
                break;
            case EventType.OmnisharpServerVerboseMessage:
                this.handleOmnisharpServerVerboseMessage(<OmnisharpServerVerboseMessage>event);
                break;
            case EventType.OmnisharpEventPacketReceived:
                this.handleOmnisharpEventPacketReceived(<OmnisharpEventPacketReceived>event);
                break;
        }
    }

    private handleOmnisharpRequestMessage(event: OmnisharpRequestMessage) {
        this.logger.append(`makeRequest: ${event.request.command} (${event.id})`);
        if (event.request.data) {
            this.logger.append(`, data=${JSON.stringify(event.request.data)}`);
        }
        this.logger.appendLine();
    }

    private handleOmnisharpServerEnqueueRequest(event: OmnisharpServerEnqueueRequest) {
        this.logger.appendLine(`Enqueue to ${event.queueName} request for ${event.command}.`);
        this.logger.appendLine();
    }

    private handleOmnisharpServerDequeueRequest(event: OmnisharpServerDequeueRequest) {
        this.logger.appendLine(`Dequeue from ${event.queueName} with status ${event.queueStatus} request for ${event.command}${event.id ? ` (${event.id})` : ''}.`);
        this.logger.appendLine();
    }

    private handleOmnisharpServerRequestCancelled(event: OmnisharpServerRequestCancelled) {
        this.logger.appendLine(`Cancelled request for ${event.command} (${event.id}).`);
        this.logger.appendLine();
    }

    private handleOmnisharpProcessRequestStart(event: OmnisharpServerProcessRequestStart) {
        this.logger.appendLine(`Processing ${event.name} queue, available slots ${event.availableRequestSlots}`);
        this.logger.increaseIndent();
    }

    private handleOmnisharpServerVerboseMessage(event: OmnisharpServerVerboseMessage) {
        this.logger.appendLine(event.message);
    }

    private handleOmnisharpEventPacketReceived(event: OmnisharpEventPacketReceived) {
        if (this._isFilterableOutput(event)) {
            let output = `[${this.getLogLevelPrefix(event.logLevel)}]: ${event.name}${os.EOL}${event.message}`;

            const newLinePlusPadding = os.EOL + "        ";
            output = output.replace(os.EOL, newLinePlusPadding);

            this.logger.appendLine(output);
        }
    }

    private _isFilterableOutput(event: OmnisharpEventPacketReceived) {
        // filter messages like: /codecheck: 200 339ms
        const timing200Pattern = /^\/[\/\w]+: 200 \d+ms/;

        return event.logLevel === "INFORMATION"
            && event.name === "OmniSharp.Middleware.LoggingMiddleware"
            && timing200Pattern.test(event.message);
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