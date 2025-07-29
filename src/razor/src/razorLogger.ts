/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscodeAdapter from './vscodeAdapter';
import * as vscode from 'vscode';
import { RazorLanguageServerClient } from './razorLanguageServerClient';
import { MessageType } from 'vscode-languageserver-protocol';

export class RazorLogger implements vscodeAdapter.Disposable {
    public static readonly logName = 'Razor Log';
    public traceEnabled!: boolean;
    public debugEnabled!: boolean;
    public infoEnabled!: boolean;
    public readonly outputChannel: vscode.LogOutputChannel;
    public languageServerClient: RazorLanguageServerClient | undefined;

    private readonly onLogEmitter: vscodeAdapter.EventEmitter<string>;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel(vscode.l10n.t('Razor Log'), { log: true });
        this.onLogEmitter = new vscode.EventEmitter<string>();
        this.processTraceLevel();

        this.outputChannel.onDidChangeLogLevel(async () => {
            await this.updateLogLevelAsync();
        });

        this.logRazorInformation();
        this.setupToStringOverrides();
    }

    public get logLevel(): vscode.LogLevel {
        return this.outputChannel.logLevel;
    }

    /**
     * Gets the log level in numeric form that matches what is expected in rzls.
     * Matches https://github.com/dotnet/razor/blob/7390745dcd9c8831d4459437ed2e9e94125f3dd3/src/Razor/src/Microsoft.CodeAnalysis.Razor.Workspaces/Logging/LogLevel.cs#L6
     */
    public get logLevelForRZLS(): number {
        switch (this.logLevel) {
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

    public get onLog() {
        return this.onLogEmitter.event;
    }

    public logAlways(message: string) {
        this.outputChannel.info(message);
        this.onLogEmitter.fire(message);
    }

    public logWarning(message: string) {
        this.outputChannel.warn(message);
        this.onLogEmitter.fire(message);
    }

    public logError(message: string, error: unknown) {
        if (error instanceof Error) {
            this.logErrorInternal(message, error);
        } else {
            const errorMsg = String(error);
            this.logErrorInternal(message, Error(errorMsg));
        }
    }

    public logInfo(message: string) {
        if (this.infoEnabled) {
            this.outputChannel.info(message);
            this.onLogEmitter.fire(message);
        }
    }

    public logDebug(message: string) {
        if (this.debugEnabled) {
            this.outputChannel.debug(message);
            this.onLogEmitter.fire(message);
        }
    }

    public logTrace(message: string) {
        if (this.traceEnabled) {
            this.outputChannel.trace(message);
            this.onLogEmitter.fire(message);
        }
    }

    public log(message: string, level: MessageType) {
        switch (level) {
            case MessageType.Error:
                this.logError(message, new Error(message));
                break;
            case MessageType.Warning:
                this.logWarning(message);
                break;
            case MessageType.Info:
                this.logInfo(message);
                break;
            case MessageType.Debug:
                this.logDebug(message);
                break;
            case MessageType.Log:
            default:
                this.logTrace(message);
        }
    }

    public dispose() {
        this.outputChannel.dispose();
    }

    private async updateLogLevelAsync() {
        this.processTraceLevel();

        if (this.languageServerClient) {
            await this.languageServerClient.sendNotification('razor/updateLogLevel', {
                logLevel: this.logLevelForRZLS,
            });
        }
    }

    private logErrorInternal(message: string, error: Error) {
        // Always log errors
        const errorPrefixedMessage = `${message}
${error.message}
Stack Trace:
${error.stack}`;
        this.outputChannel.error(errorPrefixedMessage);
        this.onLogEmitter.fire(message);
    }

    private logRazorInformation() {
        const packageJsonContents = readOwnPackageJson();

        this.logAlways('--------------------------------------------------------------------------------');
        this.logAlways(`Razor.VSCode version ${packageJsonContents.defaults.razor}`);
        this.logAlways('--------------------------------------------------------------------------------');
        this.logAlways(`Razor's log level is currently set to '${vscode.LogLevel[this.logLevel]}'`);
        this.logAlways(" - To change Razor's log level use the gear icon on the output window");
        this.logAlways(" - To report issues invoke the 'Report a Razor issue' command via the command palette.");
        this.logAlways(
            '-----------------------------------------------------------------------' +
                '------------------------------------------------------'
        );
        this.logAlways('');
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
        this.traceEnabled = this.outputChannel.logLevel <= vscode.LogLevel.Trace;
        this.debugEnabled = this.outputChannel.logLevel <= vscode.LogLevel.Debug;
        this.infoEnabled = this.outputChannel.logLevel <= vscode.LogLevel.Info;
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
