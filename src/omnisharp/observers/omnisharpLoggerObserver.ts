/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseLoggerObserver } from '../../shared/observers/baseLoggerObserver';
import { BaseEvent } from '../../shared/loggingEvents';
import {
    OmnisharpInitialisation,
    OmnisharpLaunch,
    OmnisharpFailure,
    OmnisharpServerMessage,
    OmnisharpServerOnServerError,
    OmnisharpServerOnError,
    OmnisharpServerMsBuildProjectDiagnostics,
    OmnisharpServerOnStdErr,
    OmnisharpEventPacketReceived,
} from '../omnisharpLoggingEvents';
import * as os from 'os';
import { EventType } from '../../shared/eventType';
import * as vscode from 'vscode';
import { PlatformInformation } from '../../shared/platform';
import { Logger } from '../../logger';

export class OmnisharpLoggerObserver extends BaseLoggerObserver {
    constructor(channel: vscode.OutputChannel | Logger, private platformInformation: PlatformInformation) {
        super(channel);
    }

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
                this.handleOmnisharpServerOnStdErr(<OmnisharpServerOnStdErr>event);
                break;
            case EventType.OmnisharpEventPacketReceived:
                this.handleOmnisharpEventPacketReceived(<OmnisharpEventPacketReceived>event);
                break;
        }
    };

    private handleOmnisharpServerOnServerError(event: OmnisharpServerOnServerError) {
        if (event.err.cmd === 'dotnet --version') {
            this.logger.appendLine(
                '[ERROR] A .NET 6 SDK was not found. Please install the latest SDK from https://dotnet.microsoft.com/en-us/download/dotnet/6.0.'
            );
            return;
        } else if (event.err.message?.startsWith('Found dotnet version')) {
            this.logger.appendLine(
                `[ERROR] ${event.err} Please install the latest SDK from https://dotnet.microsoft.com/en-us/download/dotnet/6.0.`
            );
            return;
        }

        this.logger.appendLine('[ERROR] ' + event.err);
    }

    private handleOmnisharpServerOnStdErr(event: OmnisharpServerOnStdErr) {
        if (event.message.startsWith('System.BadImageFormatException: Could not load file or assembly')) {
            this.logger.appendLine(
                `[ERROR] A .NET 6 SDK for ${this.platformInformation.architecture} was not found. Please install the latest ${this.platformInformation.architecture} SDK from https://dotnet.microsoft.com/en-us/download/dotnet/6.0.`
            );
            return;
        }

        this.logger.appendLine('[STDERR] ' + event.message);
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
        if (event.hostVersion) {
            this.logger.append(` with ${event.hostIsMono ? 'Mono' : '.NET'} ${event.hostVersion}`);
            if (event.hostPath && event.hostPath.length > 0) {
                this.logger.append(` (${event.hostPath})`);
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
            event.diagnostics.Errors.forEach((error) => {
                this.logger.appendLine(
                    `${error.FileName}(${error.StartLine},${error.StartColumn}): Error: ${error.Text}`
                );
            });
            event.diagnostics.Warnings.forEach((warning) => {
                this.logger.appendLine(
                    `${warning.FileName}(${warning.StartLine},${warning.StartColumn}): Warning: ${warning.Text}`
                );
            });
            this.logger.appendLine('');
        }
    }

    private handleOmnisharpServerOnError(event: OmnisharpServerOnError) {
        if (event.errorMessage.FileName) {
            this.logger.appendLine(
                `${event.errorMessage.FileName}(${event.errorMessage.Line},${event.errorMessage.Column})`
            );
        }
        this.logger.appendLine(event.errorMessage.Text);
        this.logger.appendLine('');
    }

    private handleOmnisharpEventPacketReceived(event: OmnisharpEventPacketReceived) {
        if (!this._isFilterableOutput(event)) {
            let output = `[${this.getLogLevelPrefix(event.logLevel)}]: ${event.name}${os.EOL}${event.message}`;
            const newLinePlusPadding = os.EOL + '        ';
            output = output.replace(os.EOL, newLinePlusPadding);
            this.logger.appendLine(output);
        }
    }

    private _isFilterableOutput(event: OmnisharpEventPacketReceived) {
        // filter messages like: /codecheck: 200 339ms
        const timing200Pattern = /^\/[/\w]+: 200 \d+ms/;

        return (
            event.logLevel === 'INFORMATION' &&
            event.name === 'OmniSharp.Middleware.LoggingMiddleware' &&
            timing200Pattern.test(event.message)
        );
    }

    private getLogLevelPrefix(logLevel: string) {
        switch (logLevel) {
            case 'TRACE':
                return 'trce';
            case 'DEBUG':
                return 'dbug';
            case 'INFORMATION':
                return 'info';
            case 'WARNING':
                return 'warn';
            case 'ERROR':
                return 'fail';
            case 'CRITICAL':
                return 'crit';
            default:
                throw new Error(`Unknown log level value: ${logLevel}`);
        }
    }
}
