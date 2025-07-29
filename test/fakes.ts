/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../src/vscodeAdapter';
import * as protocol from '../src/omnisharp/protocol';
import { ITelemetryReporter } from '../src/shared/telemetryReporter';
import {
    OmnisharpServerMsBuildProjectDiagnostics,
    OmnisharpServerOnError,
    OmnisharpServerUnresolvedDependencies,
    WorkspaceInformationUpdated,
} from '../src/omnisharp/omnisharpLoggingEvents';

export const getNullChannel = (): vscode.OutputChannel => {
    const returnChannel: vscode.OutputChannel = {
        name: '',
        append: (_value: string) => {
            /** empty */
        },
        appendLine: (_value: string) => {
            /** empty */
        },
        clear: () => {
            /** empty */
        },
        show: (_preserveFocusOrColumn?: boolean | vscode.ViewColumn, _preserveFocus?: boolean) => {
            /** empty */
        },
        hide: () => {
            /** empty */
        },
        dispose: () => {
            /** empty */
        },
    };
    return returnChannel;
};

export const getNullTelemetryReporter = (): ITelemetryReporter => {
    const reporter: ITelemetryReporter = {
        sendTelemetryEvent: (
            _eventName: string,
            _properties?: { [key: string]: string },
            _measures?: { [key: string]: number }
        ) => {
            /** empty */
        },
        sendTelemetryErrorEvent: (
            _eventName: string,
            _properties?: { [key: string]: string },
            _measures?: { [key: string]: number },
            _errorProps?: string[]
        ) => {
            /** empty */
        },
    };

    return reporter;
};

export const getWorkspaceConfiguration = (): vscode.WorkspaceConfiguration => {
    const values: { [key: string]: { globalValue: any; workspaceValue: any; workspaceFolderValue: any } } = {};

    const configuration: vscode.WorkspaceConfiguration = {
        get<T>(section: string, defaultValue?: T): T | undefined {
            const result = values[section];
            if (result?.globalValue !== undefined) {
                return result.globalValue;
            } else if (result?.workspaceValue !== undefined) {
                return result.workspaceValue;
            } else if (result?.workspaceFolderValue !== undefined) {
                return result.workspaceFolderValue;
            } else {
                return defaultValue;
            }
        },
        has: (section: string) => {
            return values[section] !== undefined;
        },
        inspect<T>(
            section: string
        ):
            | { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T }
            | undefined {
            const result = values[section];
            if (!result) {
                return undefined;
            }
            return {
                key: section,
                globalValue: result.globalValue,
                defaultValue: undefined,
                workspaceValue: result.workspaceValue,
                workspaceFolderValue: result.workspaceFolderValue,
            };
        },
        update: async (section: string, value: any, _configurationTarget?: vscode.ConfigurationTarget | boolean) => {
            const existing = values[section] ?? {
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined,
            };

            switch (_configurationTarget) {
                case vscode.ConfigurationTarget.Global:
                    existing.globalValue = value;
                    break;
                case vscode.ConfigurationTarget.Workspace:
                    existing.workspaceValue = value;
                    break;
                case vscode.ConfigurationTarget.WorkspaceFolder:
                    existing.workspaceFolderValue = value;
                    break;
                case undefined:
                    existing.globalValue = value;
                    break;
            }

            values[section] = existing;

            return Promise.resolve();
        },
    };

    return configuration;
};

export function getOmnisharpMSBuildProjectDiagnosticsEvent(
    fileName: string,
    warnings: protocol.MSBuildDiagnosticsMessage[],
    errors: protocol.MSBuildDiagnosticsMessage[]
): OmnisharpServerMsBuildProjectDiagnostics {
    return new OmnisharpServerMsBuildProjectDiagnostics({
        FileName: fileName,
        Warnings: warnings,
        Errors: errors,
    });
}

export function getMSBuildDiagnosticsMessage(
    logLevel: string,
    fileName: string,
    text: string,
    startLine: number,
    startColumn: number,
    endLine: number,
    endColumn: number
): protocol.MSBuildDiagnosticsMessage {
    return {
        LogLevel: logLevel,
        FileName: fileName,
        Text: text,
        StartLine: startLine,
        StartColumn: startColumn,
        EndLine: endLine,
        EndColumn: endColumn,
    };
}

export function getOmnisharpServerOnErrorEvent(
    text: string,
    fileName: string,
    line: number,
    column: number
): OmnisharpServerOnError {
    return new OmnisharpServerOnError({
        Text: text,
        FileName: fileName,
        Line: line,
        Column: column,
    });
}

export function getUnresolvedDependenices(fileName: string): OmnisharpServerUnresolvedDependencies {
    return new OmnisharpServerUnresolvedDependencies({
        UnresolvedDependencies: [],
        FileName: fileName,
    });
}

export function getFakeVsCode(): vscode.vscode {
    return {
        commands: {
            executeCommand: <_T>(_command: string, ..._rest: any[]) => {
                throw new Error('Not Implemented');
            },
        },
        languages: {
            match: (_selector: vscode.DocumentSelector, _document: vscode.TextDocument) => {
                throw new Error('Not Implemented');
            },
        },
        window: {
            activeTextEditor: undefined,
            showInformationMessage: <T extends vscode.MessageItem>(_message: string, ..._items: T[]) => {
                throw new Error('Not Implemented');
            },
            showWarningMessage: <T extends vscode.MessageItem>(_message: string, ..._items: T[]) => {
                throw new Error('Not Implemented');
            },
            showErrorMessage: <T extends vscode.MessageItem>(_message: string, ..._items: T[]) => {
                throw new Error('Not Implemented');
            },
        },
        workspace: {
            workspaceFolders: undefined,
            getConfiguration: (_section?: string, _resource?: vscode.Uri) => {
                throw new Error('Not Implemented');
            },
            asRelativePath: (_pathOrUri: string | vscode.Uri, _includeWorkspaceFolder?: boolean) => {
                throw new Error('Not Implemented');
            },
            createFileSystemWatcher: (
                _globPattern: vscode.GlobPattern,
                _ignoreCreateEvents?: boolean,
                _ignoreChangeEvents?: boolean,
                _ignoreDeleteEvents?: boolean
            ) => {
                throw new Error('Not Implemented');
            },
            onDidChangeConfiguration: (
                _listener: (e: vscode.ConfigurationChangeEvent) => any,
                _thisArgs?: any,
                _disposables?: vscode.Disposable[]
            ): vscode.Disposable => {
                throw new Error('Not Implemented');
            },
        },
        extensions: {
            all: [],
        },
        Uri: {
            parse: () => {
                throw new Error('Not Implemented');
            },
            file: (f: string): vscode.Uri => {
                return {
                    path: f,
                    fsPath: f,
                } as unknown as vscode.Uri;
            },
        },
        version: 'myVersion',
        env: {
            appName: '',
            appRoot: '',
            language: '',
            clipboard: {
                writeText: () => {
                    throw new Error('Not Implemented');
                },
                readText: () => {
                    throw new Error('Not Implemented');
                },
            },
            machineId: '',
            sessionId: '',
            openExternal: () => {
                throw new Error('Not Implemented');
            },
        },
        l10n: {
            t: (
                options:
                    | string
                    | {
                          message: string;
                          args?: Array<string | number | boolean> | Record<string, any>;
                          comment: string | string[];
                      },
                ...args: (string | number | boolean)[] | Record<string, any>[]
            ) => {
                let message = '';
                let actualArgs:
                    | (string | number | boolean)[]
                    | Record<string, any>[]
                    | Record<string, any>
                    | undefined = args;
                if (typeof options === 'string') {
                    message = options;
                } else {
                    message = options.message;
                    actualArgs = options.args;
                }

                if (!Array.isArray(actualArgs)) {
                    throw new Error('Non-array l10n args not implemented');
                }

                const strArgs: string[] = [];
                actualArgs.forEach((arg) => {
                    if (typeof arg !== 'string') {
                        throw new Error('Non-string l10n args not implemented');
                    }

                    strArgs.push(arg);
                });

                const formatted = message.replace(/{(\d+)}/g, function (match, number) {
                    return typeof args[number] != 'undefined' ? strArgs[number] : match;
                });
                return formatted;
            },
            bundle: undefined,
            uri: undefined,
        },
    };
}

export function getMSBuildWorkspaceInformation(
    msBuildSolutionPath: string,
    msBuildProjects: protocol.MSBuildProject[]
): protocol.MsBuildWorkspaceInformation {
    return {
        SolutionPath: msBuildSolutionPath,
        Projects: msBuildProjects,
    };
}

export function getWorkspaceInformationUpdated(
    MsBuild: protocol.MsBuildWorkspaceInformation | undefined
): WorkspaceInformationUpdated {
    return new WorkspaceInformationUpdated({
        MsBuild,
    });
}

export function getVSCodeWithConfig(vscodeAdapter: vscode.vscode = getFakeVsCode()) {
    const _vscodeAdapterConfig = getWorkspaceConfiguration();

    vscodeAdapter.workspace.getConfiguration = (_section, _resource) => {
        return _vscodeAdapterConfig;
    };

    return vscodeAdapter;
}

export async function updateConfig(
    vscode: vscode.vscode,
    section: string | undefined,
    config: string,
    value: any
): Promise<void> {
    const workspaceConfig = vscode.workspace.getConfiguration(section);
    const configEntry = section ? `${section}.${config}` : config;
    await workspaceConfig.update(configEntry, value);
}
