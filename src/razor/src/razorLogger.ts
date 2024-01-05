/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscodeAdapter from './vscodeAdapter';
import * as vscode from 'vscode';
import { IEventEmitterFactory } from './IEventEmitterFactory';
import { LogLevel } from './logLevel';

export class RazorLogger implements vscodeAdapter.Disposable {
    public static readonly logName = 'Razor Log';
    public static readonly verbositySetting = 'razor.server.trace';
    public verboseEnabled!: boolean;
    public messageEnabled!: boolean;
    public readonly outputChannel: vscode.OutputChannel;

    private readonly onLogEmitter: vscodeAdapter.EventEmitter<string>;
    private readonly onTraceLevelChangeEmitter: vscodeAdapter.EventEmitter<LogLevel>;

    constructor(eventEmitterFactory: IEventEmitterFactory, public logLevel: LogLevel) {
        this.processTraceLevel();
        this.onLogEmitter = eventEmitterFactory.create<string>();
        this.onTraceLevelChangeEmitter = eventEmitterFactory.create<LogLevel>();

        this.outputChannel = vscode.window.createOutputChannel(RazorLogger.logName);

        this.logRazorInformation();
        this.setupToStringOverrides();
    }

    public setTraceLevel(trace: LogLevel) {
        this.logLevel = trace;
        this.processTraceLevel();
        this.logMessage(`Updated log level to: ${LogLevel[this.logLevel]}`);
        this.onTraceLevelChangeEmitter.fire(this.logLevel);
    }

    public get onLog() {
        return this.onLogEmitter.event;
    }

    public get onTraceLevelChange() {
        return this.onTraceLevelChangeEmitter.event;
    }

    public logAlways(message: string) {
        this.logWithMarker(message);
    }

    public logWarning(message: string) {
        // Always log warnings
        const warningPrefixedMessage = `(Warning) ${message}`;
        this.logAlways(warningPrefixedMessage);
    }

    public logError(message: string, error: unknown) {
        if (error instanceof Error) {
            this.logErrorInternal(message, error);
        } else {
            const errorMsg = String(error);
            this.logErrorInternal(message, Error(errorMsg));
        }
    }

    public logMessage(message: string) {
        if (this.messageEnabled) {
            this.logWithMarker(message);
        }
    }

    public logVerbose(message: string) {
        if (this.verboseEnabled) {
            this.logWithMarker(message);
        }
    }

    public dispose() {
        this.outputChannel.dispose();
    }

    private logErrorInternal(message: string, error: Error) {
        // Always log errors
        const errorPrefixedMessage = `(Error) ${message}
${error.message}
Stack Trace:
${error.stack}`;
        this.logAlways(errorPrefixedMessage);
    }

    private logWithMarker(message: string) {
        const timeString = new Date().toLocaleTimeString();
        const markedMessage = `[Client - ${timeString}] ${message}`;

        this.log(markedMessage);
    }

    private log(message: string) {
        this.outputChannel.appendLine(message);

        this.onLogEmitter.fire(message);
    }

    private logRazorInformation() {
        const packageJsonContents = readOwnPackageJson();

        this.log('--------------------------------------------------------------------------------');
        this.log(`Razor.VSCode version ${packageJsonContents.defaults.razor}`);
        this.log('--------------------------------------------------------------------------------');
        this.log(`Razor's log level is currently set to '${LogLevel[this.logLevel]}'`);
        this.log(" - To change Razor's log level set 'razor.server.trace' and then restart VSCode.");
        this.log(" - To report issues invoke the 'Report a Razor issue' command via the command palette.");
        this.log(
            '-----------------------------------------------------------------------' +
                '------------------------------------------------------'
        );
        this.log('');
    }

    private setupToStringOverrides() {
        vscode.Range.prototype.toString = function () {
            return `[${this.start}, ${this.end}]`;
        };

        vscode.Position.prototype.toString = function () {
            return `${this.line}:${this.character}`;
        };
    }

    private processTraceLevel() {
        this.verboseEnabled = this.logLevel <= LogLevel.Debug;
        this.messageEnabled = this.logLevel <= LogLevel.Information;
    }
}

function readOwnPackageJson() {
    const packageJsonPath = findInDirectoryOrAncestor(__dirname, 'package.json');
    return JSON.parse(fs.readFileSync(packageJsonPath).toString());
}

function findInDirectoryOrAncestor(dir: string, filename: string) {
    let searchDir: string | undefined = dir;
    while (searchDir) {
        const candidate = path.join(searchDir, filename);
        if (fs.existsSync(candidate)) {
            return candidate;
        }

        const parentDir = path.dirname(searchDir);
        searchDir = parentDir === dir ? undefined : parentDir;
    }

    throw new Error(vscode.l10n.t("Could not find '{0}' in or above '{1}'.", filename, dir));
}
