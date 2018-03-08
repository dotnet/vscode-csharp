/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message, MessageType } from "../omnisharp/messageType";
import { BaseLoggerObserver } from "./BaseLoggerObserver";

export class OmnisharpLoggerObserver extends BaseLoggerObserver {

    public onNext = (message: Message) => {
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
            case MessageType.OmnisharpServerOnServerError:
                this.logger.appendLine(message.message);
                break;
            case MessageType.OmnisharpServerOnError:
                if (message.errorMessage.FileName) {
                    this.logger.appendLine(`${message.errorMessage.FileName}(${message.errorMessage.Line},${message.errorMessage.Column})`);
                }
                this.logger.appendLine(message.errorMessage.Text);
                this.logger.appendLine("");
                break;
            case MessageType.OmnisharpServerMsBuildProjectDiagnostics:
                if (message.diagnostics.Errors.length > 0 || message.diagnostics.Warnings.length > 0) {
                    this.logger.appendLine(message.diagnostics.FileName);
                    message.diagnostics.Errors.forEach(error => {
                        this.logger.appendLine(`${error.FileName}(${error.StartLine},${error.StartColumn}): Error: ${error.Text}`);
                    });
                    message.diagnostics.Warnings.forEach(warning => {
                        this.logger.appendLine(`${warning.FileName}(${warning.StartLine},${warning.StartColumn}): Warning: ${warning.Text}`);
                    });
                    this.logger.appendLine("");
                }
                break;
            case MessageType.OmnisharpServerOnStdErr:
                this.logger.append(message.message);
                break;
        }
    }


}
