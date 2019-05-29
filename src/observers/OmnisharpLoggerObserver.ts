/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseLoggerObserver } from "./BaseLoggerObserver";
import { BaseEvent, OmnisharpInitialisation, OmnisharpLaunch, OmnisharpFailure, OmnisharpServerMessage, OmnisharpServerOnServerError, OmnisharpServerOnError, OmnisharpServerMsBuildProjectDiagnostics, OmnisharpServerOnStdErr, OmnisharpEventPacketReceived } from "../omnisharp/loggingEvents";
import * as os from 'os';
import { EventType } from "../omnisharp/EventType";

export class OmnisharpLoggerObserver extends BaseLoggerObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpInitialisation:
                this.handleOmnisharpInitialisation(<OmnisharpInitialisation>event);
                break;
            case EventType.OmnisharpLaunch:
                this.handleOmnisharpLaunch(<OmnisharpLaunch>event);
                break;
            case EventType.OmnisharpFailure:
                this.logger.appendLine((<OmnisharpFailure>event).message);
                this.logger.appendLine();
                break;
            case EventType.OmnisharpServerMessage:
                this.logger.appendLine((<OmnisharpServerMessage>event).message);
                break;
            case EventType.OmnisharpServerOnServerError:
                this.handleOmnisharpServerOnServerError(<OmnisharpServerOnServerError>event);
                break;
            case EventType.OmnisharpServerOnError:
                this.handleOmnisharpServerOnError(<OmnisharpServerOnError>event);
                break;
            case EventType.OmnisharpServerMsBuildProjectDiagnostics:
                this.handleOmnisharpServerMsBuildProjectDiagnostics(<OmnisharpServerMsBuildProjectDiagnostics>event);
                break;
            case EventType.OmnisharpServerOnStdErr:
                this.logger.append((<OmnisharpServerOnStdErr>event).message);
                break;
            case EventType.OmnisharpEventPacketReceived:
                this.handleOmnisharpEventPacketReceived(<OmnisharpEventPacketReceived>event);
                break;
        }
    }

    private handleOmnisharpServerOnServerError(event: OmnisharpServerOnServerError) {
        this.logger.appendLine('[ERROR] ' + event.err);
    }

    private handleOmnisharpInitialisation(event: OmnisharpInitialisation) {
        this.logger.appendLine(`Starting OmniSharp server at ${event.timeStamp.toLocaleString()}`);
        this.logger.increaseIndent();
        this.logger.appendLine(`Target: ${event.solutionPath}`);
        this.logger.decreaseIndent();
        this.logger.appendLine();
    }

    private handleOmnisharpLaunch(event: OmnisharpLaunch) {
        this.logger.append(`OmniSharp server started`);
        if (event.monoVersion) {
            this.logger.append(` with Mono ${event.monoVersion}`);
            if (event.monoPath !== undefined) {
                this.logger.append(` (${event.monoPath})`);
            }
        }
        this.logger.appendLine('.');

        this.logger.increaseIndent();
        this.logger.appendLine(`Path: ${event.command}`);
        this.logger.appendLine(`PID: ${event.pid}`);
        this.logger.decreaseIndent();
        this.logger.appendLine();
    }

    private handleOmnisharpServerMsBuildProjectDiagnostics(event: OmnisharpServerMsBuildProjectDiagnostics) {
        if (event.diagnostics.Errors.length > 0 || event.diagnostics.Warnings.length > 0) {
            this.logger.appendLine(event.diagnostics.FileName);
            event.diagnostics.Errors.forEach(error => {
                this.logger.appendLine(`${error.FileName}(${error.StartLine},${error.StartColumn}): Error: ${error.Text}`);
            });
            event.diagnostics.Warnings.forEach(warning => {
                this.logger.appendLine(`${warning.FileName}(${warning.StartLine},${warning.StartColumn}): Warning: ${warning.Text}`);
            });
            this.logger.appendLine("");
        }
    }

    private handleOmnisharpServerOnError(event: OmnisharpServerOnError) {
        if (event.errorMessage.FileName) {
            this.logger.appendLine(`${event.errorMessage.FileName}(${event.errorMessage.Line},${event.errorMessage.Column})`);
        }
        this.logger.appendLine(event.errorMessage.Text);
        this.logger.appendLine("");
    }

    private handleOmnisharpEventPacketReceived(event: OmnisharpEventPacketReceived) {
        if (!this._isFilterableOutput(event)) {
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
