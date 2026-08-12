/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocumentSelector } from 'vscode-languageclient';
import * as path from 'path';

export interface CommonOptions {
    readonly waitForDebugger: boolean;
    readonly serverPath: string;
    readonly excludePaths: string[];

    /** The default solution; this has been normalized to a full file path from the workspace folder it was configured in, or the string "disable" if that has been disabled */
    readonly defaultSolution: string;
    readonly unitTestDebuggingOptions: object;
    readonly runSettingsPath: string;
    readonly organizeImportsOnFormat: boolean;
    readonly disableAIFeatures: boolean;
}

export interface LanguageServerOptions {
    readonly documentSelector: DocumentSelector;
    readonly extensionsPaths: string[] | null;
    readonly preferCSharpExtension: boolean;
    readonly startTimeout: number;
    readonly crashDumpPath: string | undefined;
    readonly analyzerDiagnosticScope: string;
    readonly compilerDiagnosticScope: string;
    readonly componentPaths: { [key: string]: string } | null;
    readonly enableXamlTools: boolean;
    readonly suppressLspErrorToasts: boolean;
    readonly suppressMiscellaneousFilesToasts: boolean;
    readonly useServerGC: boolean;
    readonly reportInformationAsHint: boolean;
    readonly environmentVariables: { [key: string]: string };
    readonly sourceGeneratorExecution: string;
    readonly toolingRuntimePath: string;
}

class CommonOptionsImpl implements CommonOptions {
    public get waitForDebugger() {
        return readOption<boolean>('dotnet.server.waitForDebugger', false);
    }
    public get serverPath() {
        return readOption<string>('dotnet.server.path', '');
    }
    public get excludePaths() {
        return getExcludedPaths();
    }

    /** The default solution; this has been normalized to a full file path from the workspace folder it was configured in, or the string "disable" if that has been disabled */
    public get defaultSolution() {
        let defaultSolution = '';
        const defaultSolutionFromWorkspace = readOption<string>('dotnet.defaultSolution', '');

        // If the workspace has defaultSolution disabled, just be done
        if (defaultSolutionFromWorkspace === 'disable') {
            defaultSolution = 'disable';
        } else {
            if (vscode.workspace.workspaceFolders !== undefined) {
                // If this is multi-folder, then check to see if we have a fully qualified path set directly in the workspace settings; this will let the user directly specify in their
                // workspace settings which one is active in the case of a multi-folder workspace. This has to be absolute because in this case, there's no clear folder to resolve a relative
                // path against.
                if (vscode.workspace.workspaceFolders.length > 1) {
                    if (path.isAbsolute(defaultSolutionFromWorkspace)) {
                        defaultSolution = defaultSolutionFromWorkspace;
                    }
                }

                // If we didn't have an absolute workspace setting, then check each workspace folder and resolve any relative paths against it
                if (defaultSolution == '') {
                    for (const workspaceFolder of vscode.workspace.workspaceFolders) {
                        const workspaceFolderConfig = vscode.workspace.getConfiguration(undefined, workspaceFolder.uri);
                        const defaultSolutionFromWorkspaceFolder = readOptionFromConfig<string>(
                            workspaceFolderConfig,
                            'dotnet.defaultSolution',
                            ''
                        );
                        if (
                            defaultSolutionFromWorkspaceFolder !== '' &&
                            defaultSolutionFromWorkspaceFolder !== 'disable'
                        ) {
                            defaultSolution = path.join(workspaceFolder.uri.fsPath, defaultSolutionFromWorkspaceFolder);
                            break;
                        }
                    }
                }
            }
        }

        return defaultSolution;
    }

    public get unitTestDebuggingOptions() {
        return readOption<object>('dotnet.unitTestDebuggingOptions', {}, 'csharp.unitTestDebuggingOptions');
    }
    public get runSettingsPath() {
        return readOption<string>('dotnet.unitTests.runSettingsPath', '');
    }
    public get organizeImportsOnFormat() {
        return readOption<boolean>('dotnet.formatting.organizeImportsOnFormat', false);
    }
    public get disableAIFeatures() {
        return readOption<boolean>('chat.disableAIFeatures', false);
    }
}

class LanguageServerOptionsImpl implements LanguageServerOptions {
    public get documentSelector() {
        return readOption<DocumentSelector>('dotnet.server.documentSelector', ['csharp']);
    }
    public get extensionsPaths() {
        return readOption<string[] | null>('dotnet.server.extensionPaths', null);
    }
    public get preferCSharpExtension() {
        return readOption<boolean>('dotnet.preferCSharpExtension', false);
    }
    public get startTimeout() {
        return readOption<number>('dotnet.server.startTimeout', 30000);
    }
    public get crashDumpPath() {
        return readOption<string | undefined>('dotnet.server.crashDumpPath', undefined);
    }
    public get analyzerDiagnosticScope() {
        return readOption<string>('dotnet.backgroundAnalysis.analyzerDiagnosticsScope', 'openFiles');
    }
    public get compilerDiagnosticScope() {
        return readOption<string>('dotnet.backgroundAnalysis.compilerDiagnosticsScope', 'openFiles');
    }
    public get componentPaths() {
        return readOption<{ [key: string]: string }>('dotnet.server.componentPaths', {});
    }
    public get enableXamlTools() {
        return readOption<boolean>('dotnet.enableXamlTools', true);
    }
    public get suppressLspErrorToasts() {
        return readOption<boolean>('dotnet.server.suppressLspErrorToasts', false);
    }
    public get suppressMiscellaneousFilesToasts() {
        return readOption<boolean>('dotnet.server.suppressMiscellaneousFilesToasts', false);
    }
    public get useServerGC() {
        return readOption<boolean>('dotnet.server.useServerGC', true);
    }
    public get reportInformationAsHint() {
        return readOption<boolean>('dotnet.diagnostics.reportInformationAsHint', true);
    }
    public get environmentVariables() {
        return readOption<{ [key: string]: string }>('dotnet.server.environmentVariables', {});
    }
    public get sourceGeneratorExecution() {
        return readOption<string>('dotnet.server.sourceGeneratorExecution', 'Balanced');
    }
    public get toolingRuntimePath() {
        return readOption<string>('dotnet.toolingRuntimePath', '');
    }
}

export const commonOptions: CommonOptions = new CommonOptionsImpl();
export const languageServerOptions: LanguageServerOptions = new LanguageServerOptionsImpl();

function getExcludedPaths(): string[] {
    const workspaceConfig = vscode.workspace.getConfiguration();

    const excludePaths = getExcludes(workspaceConfig, 'files.exclude');
    return excludePaths;

    function getExcludes(config: vscode.WorkspaceConfiguration, option: string): string[] {
        const optionValue = config.get<{ [i: string]: boolean }>(option, {});
        return Object.entries(optionValue)
            .filter(([_, value]) => value)
            .map(([key, _]) => key);
    }
}

/**
 * Reads an option from the vscode config with an optional back compat parameter.
 */
function readOptionFromConfig<T>(
    config: vscode.WorkspaceConfiguration,
    option: string,
    defaultValue: T,
    ...backCompatOptionNames: string[]
): T {
    let value = config.get<T>(option);

    if (value === undefined && backCompatOptionNames.length > 0) {
        // Search the back compat options for a defined value.
        value = backCompatOptionNames.map((name) => config.get<T>(name)).find((val) => val);
    }

    return value ?? defaultValue;
}

function readOption<T>(option: string, defaultValue: T, ...backCompatOptionNames: string[]): T {
    return readOptionFromConfig(vscode.workspace.getConfiguration(), option, defaultValue, ...backCompatOptionNames);
}

export const CommonOptionsThatTriggerReload: ReadonlyArray<keyof CommonOptions> = [
    'waitForDebugger',
    'serverPath',
    'disableAIFeatures',
];

export const LanguageServerOptionsThatTriggerReload: ReadonlyArray<keyof LanguageServerOptions> = [
    'documentSelector',
    'preferCSharpExtension',
    'componentPaths',
    'enableXamlTools',
    'useServerGC',
    'reportInformationAsHint',
    'environmentVariables',
    'sourceGeneratorExecution',
    'crashDumpPath',
    'toolingRuntimePath',
];
