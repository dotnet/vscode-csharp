/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../../../src/vscodeAdapter';
import * as protocol from '../../../src/omnisharp/protocol';
import { DocumentSelector, MessageItem, TextDocument, Uri } from '../../../src/vscodeAdapter';
import { ITelemetryReporter } from '../../../src/observers/TelemetryObserver';
import { MSBuildDiagnosticsMessage } from '../../../src/omnisharp/protocol';
import { OmnisharpServerMsBuildProjectDiagnostics, OmnisharpServerOnError, OmnisharpServerUnresolvedDependencies } from '../../../src/omnisharp/loggingEvents';

export const getNullChannel = (): vscode.OutputChannel => {
    let returnChannel: vscode.OutputChannel = {
        name: "",
        append: (value: string) => { },
        appendLine: (value: string) => { },
        clear: () => { },
        show: (preserveFocusOrColumn?: boolean | vscode.ViewColumn, preserveFocus?: boolean) => { },
        hide: () => { },
        dispose: () => { }
    };
    return returnChannel;
};

export const getNullTelemetryReporter = (): ITelemetryReporter => {
    let reporter: ITelemetryReporter = {
        sendTelemetryEvent: (eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }) => { }
    };

    return reporter;
};

export const getNullWorkspaceConfiguration = (): vscode.WorkspaceConfiguration => {
    let workspace: vscode.WorkspaceConfiguration = {
        get:<T> (section: string) => {
            return true;
        },
        has: (section: string) => { return true; },
        inspect: () => {
            return {
                key: "somekey"
            };
        },
        update: () => { return Promise.resolve(); },
    };
    return workspace;
};

export function getOmnisharpMSBuildProjectDiagnosticsEvent(fileName: string, warnings: MSBuildDiagnosticsMessage[], errors: MSBuildDiagnosticsMessage[]): OmnisharpServerMsBuildProjectDiagnostics {
    return new OmnisharpServerMsBuildProjectDiagnostics({
        FileName: fileName,
        Warnings: warnings,
        Errors: errors
    });
}

export function getMSBuildDiagnosticsMessage(logLevel: string,
    fileName: string,
    text: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number): MSBuildDiagnosticsMessage {
    return {
        LogLevel: logLevel,
        FileName: fileName,
        Text: text,
        StartLine: startLine,
        StartColumn: startColumn,
        EndLine: endLine,
        EndColumn: endColumn
    };
}

export function getOmnisharpServerOnErrorEvent(text: string, fileName: string, line: number, column: number): OmnisharpServerOnError {
    return new OmnisharpServerOnError({
        Text: text,
        FileName: fileName,
        Line: line,
        Column: column
    });
}

export function getUnresolvedDependenices(fileName: string): OmnisharpServerUnresolvedDependencies {
    return new OmnisharpServerUnresolvedDependencies({
        UnresolvedDependencies: [],
        FileName: fileName
    });
}

export function getFakeVsCode(): vscode.vscode {
    return {
        commands: {
            executeCommand: <T>(command: string, ...rest: any[]) => {
                throw new Error("Not Implemented");
            }
        },
        languages: {
            match: (selector: DocumentSelector, document: TextDocument) => {
                throw new Error("Not Implemented");
            }
        },
        window: {
            activeTextEditor: undefined,
            showInformationMessage: (message: string, ...items: string[]) => {
                throw new Error("Not Implemented");
            },
            showWarningMessage: <T extends MessageItem>(message: string, ...items: T[]) => {
                throw new Error("Not Implemented");
            }
        },
        workspace: {
            getConfiguration: (section?: string, resource?: Uri) => {
                throw new Error("Not Implemented");
            },
            asRelativePath: (pathOrUri: string | Uri, includeWorkspaceFolder?: boolean) => {
                throw new Error("Not Implemented");
            }
        }
    };
}