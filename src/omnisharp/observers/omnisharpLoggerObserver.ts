/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message, MessageType, OmnisharpEventPacketReceived } from "../messageType";
import { Logger } from "../../logger";
import * as os from 'os';

export class OmnisharpLoggerObserver {

    private logger;
    private debugMode: boolean;

    constructor(loggerCreator: () => Logger, debugMode: boolean) {
        this.logger = loggerCreator();
        this.debugMode = debugMode;
    }

    onNext(message: Message): void {
        switch (message.type) {
            case MessageType.OmnisharpInitialisation:
                this.logger.appendLine(`Starting OmniSharp server at ${message.timeStamp.toLocaleString()}`);
                this.logger.increaseIndent();
                this.logger.appendLine(`Target: ${message.solutionPath}`);
                this.logger.decreaseIndent();
                this.logger.appendLine();
                break;
            case MessageType.OmnisharpLaunch:
                if (message.usingMono) {
                    this.logger.appendLine(`OmniSharp server started with Mono`);
                }
                else {
                    this.logger.appendLine(`OmniSharp server started`);
                }

                this.logger.increaseIndent();
                this.logger.appendLine(`Path: ${message.command}`);
                this.logger.appendLine(`PID: ${message.pid}`);
                this.logger.decreaseIndent();
                this.logger.appendLine();
                break;
            case MessageType.OmnisharpFailure:
            case MessageType.OmnisharpServerMessage:
                this.logger.appendLine(message.message);
                this.logger.appendLine();
                break;
            case MessageType.OmnisharpRequestMessage:
                if (this.debugMode) {
                    this.logger.append(`makeRequest: ${message.request.command} (${message.id})`);
                    if (message.request.data) {
                        this.logger.append(`, data=${JSON.stringify(message.request.data)}`);
                    }
                    this.logger.appendLine();
                }
                break;
            case MessageType.OmnisharpServerVerboseMessage:
                if (this.debugMode) {
                    this.logger.appendLine(message.message);
                    this.logger.appendLine();
                }
                break;
            case MessageType.OmnisharpEventPacketReceived:
                if (this.debugMode || !this._isFilterableOutput(message)) {
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