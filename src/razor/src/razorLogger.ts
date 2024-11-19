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
import { RazorLanguageServerClient } from './razorLanguageServerClient';

export class RazorLogger implements vscodeAdapter.Disposable {
    public static readonly logName = 'Razor Log';
    public verboseEnabled!: boolean;
    public messageEnabled!: boolean;
    public readonly outputChannel: vscode.LogOutputChannel;
    public languageServerClient: RazorLanguageServerClient | undefined;

    private readonly onLogEmitter: vscodeAdapter.EventEmitter<string>;

    constructor(eventEmitterFactory: IEventEmitterFactory, public logLevel: LogLevel) {
        this.outputChannel = vscode.window.createOutputChannel(vscode.l10n.t('Razor Log'), { log: true });
        this.onLogEmitter = eventEmitterFactory.create<string>();
        this.processTraceLevel();

        this.outputChannel.onDidChangeLogLevel(async () => {
            await this.updateLogLevelAsync();
        });

        this.logRazorInformation();
        this.setupToStringOverrides();
    }

    async updateLogLevelAsync() {
        this.processTraceLevel();

        if (this.languageServerClient) {
            await this.languageServerClient.sendNotification('razor/updateLogLevel', {
                logLevel: convertLogLevel(this.outputChannel.logLevel),
            });
        }
    }

    public get onLog() {
        return this.onLogEmitter.event;
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
        this.verboseEnabled = this.outputChannel.logLevel >= vscode.LogLevel.Trace;
        this.messageEnabled = this.outputChannel.logLevel >= vscode.LogLevel.Info;
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

// Matches src\Razor\src\Microsoft.CodeAnalysis.Razor.Workspaces\Logging\LogLevel.cs
function convertLogLevel(logLevel: vscode.LogLevel): number {
    switch (logLevel) {
        case vscode.LogLevel.Off:
            return 0;
        case vscode.LogLevel.Trace:
            return 1;
        case vscode.LogLevel.Debug:
            return 2;
        case vscode.LogLevel.Info:
            return 3;
        case vscode.LogLevel.Warning:
            return 4;
        case vscode.LogLevel.Error:
            return 5;
        default:
            throw new Error('Unexpected log level value. Do not know how to convert');
    }
}
