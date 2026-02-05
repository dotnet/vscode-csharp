/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Represents a logged message with its level and content.
 */
export interface LogMessage {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: Date;
}

/**
 * A wrapper around vscode.LogOutputChannel that emits events when messages are logged.
 * This allows capturing log messages regardless of the UI log level filter.
 */
export class ObservableLogOutputChannel implements vscode.LogOutputChannel {
    private readonly _onMessageLogged = new vscode.EventEmitter<LogMessage>();

    /**
     * Event that fires whenever a message is logged to this channel.
     */
    public readonly onMessageLogged: vscode.Event<LogMessage> = this._onMessageLogged.event;

    constructor(private readonly _channel: vscode.LogOutputChannel) {}

    /**
     * Gets the underlying LogOutputChannel.
     */
    public get channel(): vscode.LogOutputChannel {
        return this._channel;
    }

    /**
     * Creates a new LogObserver that collects log messages from this channel.
     * Call `stop()` on the returned observer to stop collecting and get the formatted log content.
     */
    public observe(): LogObserver {
        return new LogObserver(this);
    }

    // Implement LogOutputChannel interface by delegating to the underlying channel

    public get name(): string {
        return this._channel.name;
    }

    public get logLevel(): vscode.LogLevel {
        return this._channel.logLevel;
    }

    public get onDidChangeLogLevel(): vscode.Event<vscode.LogLevel> {
        return this._channel.onDidChangeLogLevel;
    }

    public trace(message: string, ...args: any[]): void {
        this._channel.trace(message, ...args);
        this._onMessageLogged.fire({
            level: 'trace',
            message: this.formatMessage(message, args),
            timestamp: new Date(),
        });
    }

    public debug(message: string, ...args: any[]): void {
        this._channel.debug(message, ...args);
        this._onMessageLogged.fire({
            level: 'debug',
            message: this.formatMessage(message, args),
            timestamp: new Date(),
        });
    }

    public info(message: string, ...args: any[]): void {
        this._channel.info(message, ...args);
        this._onMessageLogged.fire({
            level: 'info',
            message: this.formatMessage(message, args),
            timestamp: new Date(),
        });
    }

    public warn(message: string, ...args: any[]): void {
        this._channel.warn(message, ...args);
        this._onMessageLogged.fire({
            level: 'warn',
            message: this.formatMessage(message, args),
            timestamp: new Date(),
        });
    }

    public error(error: string | Error, ...args: any[]): void {
        this._channel.error(error, ...args);
        const message = error instanceof Error ? error.message : error;
        this._onMessageLogged.fire({
            level: 'error',
            message: this.formatMessage(message, args),
            timestamp: new Date(),
        });
    }

    public append(value: string): void {
        this._channel.append(value);
    }

    public appendLine(value: string): void {
        this._channel.appendLine(value);
    }

    public replace(value: string): void {
        this._channel.replace(value);
    }

    public clear(): void {
        this._channel.clear();
    }

    public show(preserveFocus?: boolean): void;
    public show(column?: vscode.ViewColumn, preserveFocus?: boolean): void;
    public show(columnOrPreserveFocus?: vscode.ViewColumn | boolean, preserveFocus?: boolean): void {
        if (typeof columnOrPreserveFocus === 'boolean') {
            this._channel.show(columnOrPreserveFocus);
        } else {
            this._channel.show(columnOrPreserveFocus, preserveFocus);
        }
    }

    public hide(): void {
        this._channel.hide();
    }

    public dispose(): void {
        this._onMessageLogged.dispose();
        this._channel.dispose();
    }

    private formatMessage(message: string, args: any[]): string {
        if (args.length === 0) {
            return message;
        }
        // Format additional arguments similar to how VS Code does it
        const formattedArgs = args.map((arg) => {
            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        });
        return `${message} ${formattedArgs.join(' ')}`;
    }
}

/**
 * Observes log messages from an ObservableLogOutputChannel and collects them until disposed.
 */
export class LogObserver {
    private readonly _messages: LogMessage[] = [];
    private readonly _subscription: vscode.Disposable;

    constructor(channel: ObservableLogOutputChannel) {
        this._subscription = channel.onMessageLogged((message) => {
            this._messages.push(message);
        });
    }

    /**
     * Returns the collected messages as a formatted string suitable for a log file.
     */
    public getLog(): string {
        return LogObserver.formatLogMessages(this._messages);
    }

    /**
     * Disposes the subscription and stops observing log messages.
     */
    public dispose(): void {
        this._subscription.dispose();
    }

    /**
     * Formats an array of log messages into a string suitable for a log file.
     */
    public static formatLogMessages(messages: LogMessage[]): string {
        return messages
            .map((msg) => {
                const timestamp = msg.timestamp.toISOString();
                const level = msg.level.toUpperCase().padEnd(5);
                return `[${timestamp}] [${level}] ${msg.message}`;
            })
            .join('\n');
    }
}
