/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentSelector } from 'vscode-languageserver-protocol';
import { vscode, WorkspaceConfiguration } from '../vscodeAdapter';
import * as path from 'path';

export interface Option<T> {
    getValue(vscode: vscode): T;
}

export interface CommonOptionsDefinition {
    dotnetPath: Option<string>;
    waitForDebugger: Option<boolean>;
    serverPath: Option<string>;
    useOmnisharpServer: Option<boolean>;
    excludePaths: Option<string[]>;

    /** The default solution; this has been normalized to a full file path from the workspace folder it was configured in, or the string "disable" if that has been disabled */
    defaultSolution: Option<string>;
    unitTestDebuggingOptions: Option<object>;
    runSettingsPath: Option<string>;
}

export interface OmnisharpServerOptionsDefinition {
    useModernNet: Option<boolean>;
    monoPath: Option<string>;
    loggingLevel: Option<string>;
    autoStart: Option<boolean>;
    projectFilesExcludePattern: Option<string>;
    projectLoadTimeout: Option<number>;
    maxProjectResults: Option<number>;
    useEditorFormattingSettings: Option<boolean>;
    enableRoslynAnalyzers: Option<boolean>;
    enableEditorConfigSupport: Option<boolean>;
    enableDecompilationSupport: Option<boolean>;
    enableImportCompletion: Option<boolean>;
    enableAsyncCompletion: Option<boolean>;
    analyzeOpenDocumentsOnly: Option<boolean>;
    organizeImportsOnFormat: Option<boolean>;
    disableMSBuildDiagnosticWarning: Option<boolean>;
    showOmnisharpLogOnError: Option<boolean>;
    minFindSymbolsFilterLength: Option<number>;
    maxFindSymbolsItems: Option<number>;
    enableMsBuildLoadProjectsOnDemand: Option<boolean>;
    sdkPath: Option<string>;
    sdkVersion: Option<string>;
    sdkIncludePrereleases: Option<boolean>;
    dotNetCliPaths: Option<string[]>;
    useFormatting: Option<boolean>;
    showReferencesCodeLens: Option<boolean>;
    showTestsCodeLens: Option<boolean>;
    filteredSymbolsCodeLens: Option<string[]>;
    disableCodeActions: Option<boolean>;
    useSemanticHighlighting: Option<boolean>;
    inlayHintsEnableForParameters: Option<boolean>;
    inlayHintsForLiteralParameters: Option<boolean>;
    inlayHintsForObjectCreationParameters: Option<boolean>;
    inlayHintsForIndexerParameters: Option<boolean>;
    inlayHintsForOtherParameters: Option<boolean>;
    inlayHintsSuppressForParametersThatDifferOnlyBySuffix: Option<boolean>;
    inlayHintsSuppressForParametersThatMatchMethodIntent: Option<boolean>;
    inlayHintsSuppressForParametersThatMatchArgumentName: Option<boolean>;
    inlayHintsEnableForTypes: Option<boolean>;
    inlayHintsForImplicitVariableTypes: Option<boolean>;
    inlayHintsForLambdaParameterTypes: Option<boolean>;
    inlayHintsForImplicitObjectCreation: Option<boolean>;
    maxProjectFileCountForDiagnosticAnalysis: Option<number>;
    suppressDotnetRestoreNotification: Option<boolean>;
    enableLspDriver: Option<boolean | null>;
}

export interface LanguageServerOptionsDefinition {
    logLevel: Option<string>;
    documentSelector: Option<DocumentSelector>;
    extensionsPaths: Option<string[] | null>;
}

export interface RazorOptionsDefinition {
    razorDevMode: Option<boolean>;
    razorPluginPath: Option<string>;
}

export const commonOptions: CommonOptionsDefinition = {
    dotnetPath: {
        getValue: (vscode: vscode) =>
            // VS Code coerces unset string settings to the empty string.
            // Thus, to avoid dealing with the empty string AND undefined,
            // explicitly pass in the empty string as the fallback if the setting
            // isn't defined in package.json (which should never happen).
            readOption<string>(vscode, 'dotnet.dotnetPath', '', 'omnisharp.dotnetPath'),
    },
    waitForDebugger: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(vscode, 'dotnet.server.waitForDebugger', false, 'omnisharp.waitForDebugger'),
    },
    serverPath: {
        getValue: (vscode: vscode) =>
            readOption<string>(vscode, 'dotnet.server.path', '', 'omnisharp.path', 'csharp.omnisharp'),
    },
    useOmnisharpServer: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'dotnet.server.useOmnisharp', false),
    },
    excludePaths: {
        getValue: (vscode: vscode) => getExcludedPaths(vscode),
    },

    /** The default solution; this has been normalized to a full file path from the workspace folder it was configured in, or the string "disable" if that has been disabled */
    defaultSolution: {
        getValue: (vscode: vscode) => {
            let defaultSolution = '';

            const defaultSolutionFromWorkspace = readOption<string>(
                vscode,
                'dotnet.defaultSolution',
                '',
                'omnisharp.defaultLaunchSolution'
            );

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
                            const workspaceFolderConfig = vscode.workspace.getConfiguration(
                                undefined,
                                workspaceFolder.uri
                            );
                            const defaultSolutionFromWorkspaceFolder = readOptionFromConfig<string>(
                                vscode,
                                workspaceFolderConfig,
                                'dotnet.defaultSolution',
                                '',
                                'omnisharp.defaultLaunchSolution'
                            );
                            if (
                                defaultSolutionFromWorkspaceFolder !== '' &&
                                defaultSolutionFromWorkspaceFolder !== 'disable'
                            ) {
                                defaultSolution = path.join(
                                    workspaceFolder.uri.fsPath,
                                    defaultSolutionFromWorkspaceFolder
                                );
                                break;
                            }
                        }
                    }
                }
            }

            return defaultSolution;
        },
    },
    unitTestDebuggingOptions: {
        getValue: (vscode: vscode) =>
            readOption<object>(vscode, 'dotnet.unitTestDebuggingOptions', {}, 'csharp.unitTestDebuggingOptions'),
    },
    runSettingsPath: {
        getValue: (vscode: vscode) =>
            readOption<string>(vscode, 'dotnet.unitTests.runSettingsPath', '', 'omnisharp.testRunSettings'),
    },
};

export const omnisharpOptions: OmnisharpServerOptionsDefinition = {
    useModernNet: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.useModernNet', true),
    },
    monoPath: {
        getValue: (vscode: vscode) => readOption<string>(vscode, 'omnisharp.monoPath', ''),
    },
    loggingLevel: {
        getValue: (vscode: vscode) => {
            let loggingLevel = readOption<string>(vscode, 'omnisharp.loggingLevel', 'information');
            if (loggingLevel && loggingLevel.toLowerCase() === 'verbose') {
                loggingLevel = 'debug';
            }
            return loggingLevel;
        },
    },
    autoStart: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.autoStart', true),
    },
    projectFilesExcludePattern: {
        getValue: (vscode: vscode) =>
            readOption<string>(
                vscode,
                'omnisharp.projectFilesExcludePattern',
                '**/node_modules/**,**/.git/**,**/bower_components/**'
            ),
    },
    projectLoadTimeout: {
        getValue: (vscode: vscode) => readOption<number>(vscode, 'omnisharp.projectLoadTimeout', 60),
    },
    maxProjectResults: {
        getValue: (vscode: vscode) => readOption<number>(vscode, 'omnisharp.maxProjectResults', 250),
    },
    useEditorFormattingSettings: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.useEditorFormattingSettings', true),
    },
    enableRoslynAnalyzers: {
        getValue: (vscode: vscode) => {
            const enableRoslynAnalyzersLegacyOption = readOption<boolean>(
                vscode,
                'omnisharp.enableRoslynAnalyzers',
                false
            );

            const diagnosticAnalysisScope = readOption<string>(
                vscode,
                'dotnet.backgroundAnalysis.analyzerDiagnosticsScope',
                commonOptions.useOmnisharpServer.getValue(vscode) ? 'none' : 'openFiles'
            );
            const enableRoslynAnalyzersNewOption = diagnosticAnalysisScope != 'none';
            return enableRoslynAnalyzersLegacyOption || enableRoslynAnalyzersNewOption;
        },
    },
    enableEditorConfigSupport: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.enableEditorConfigSupport', true),
    },
    enableDecompilationSupport: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.enableDecompilationSupport', false),
    },
    enableImportCompletion: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.completion.showCompletionItemsFromUnimportedNamespaces',
                false,
                'omnisharp.enableImportCompletion'
            ),
    },
    enableAsyncCompletion: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.enableAsyncCompletion', false),
    },
    analyzeOpenDocumentsOnly: {
        getValue: (vscode: vscode) => {
            const analyzeOpenDocumentsOnlyLegacyOption = readOption<boolean>(
                vscode,
                'omnisharp.analyzeOpenDocumentsOnly',
                false
            );

            const diagnosticAnalysisScope = readOption<string>(
                vscode,
                'dotnet.backgroundAnalysis.analyzerDiagnosticsScope',
                commonOptions.useOmnisharpServer.getValue(vscode) ? 'none' : 'openFiles'
            );
            const analyzeOpenDocumentsOnlyNewOption = diagnosticAnalysisScope == 'openFiles';
            return analyzeOpenDocumentsOnlyLegacyOption || analyzeOpenDocumentsOnlyNewOption;
        },
    },
    organizeImportsOnFormat: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.organizeImportsOnFormat', false),
    },
    disableMSBuildDiagnosticWarning: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.disableMSBuildDiagnosticWarning', false),
    },
    showOmnisharpLogOnError: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'csharp.showOmnisharpLogOnError', true),
    },
    minFindSymbolsFilterLength: {
        getValue: (vscode: vscode) => readOption<number>(vscode, 'omnisharp.minFindSymbolsFilterLength', 0),
    },
    maxFindSymbolsItems: {
        getValue: (vscode: vscode) => readOption<number>(vscode, 'omnisharp.maxFindSymbolsItems', 1000),
    },
    enableMsBuildLoadProjectsOnDemand: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.enableMsBuildLoadProjectsOnDemand', false),
    },
    sdkPath: {
        getValue: (vscode: vscode) => readOption<string>(vscode, 'omnisharp.sdkPath', ''),
    },
    sdkVersion: {
        getValue: (vscode: vscode) => readOption<string>(vscode, 'omnisharp.sdkVersion', ''),
    },
    sdkIncludePrereleases: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.sdkIncludePrereleases', true),
    },
    dotNetCliPaths: {
        getValue: (vscode: vscode) => readOption<string[]>(vscode, 'omnisharp.dotNetCliPaths', []),
    },
    useFormatting: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'csharp.format.enable', true),
    },
    showReferencesCodeLens: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.codeLens.enableReferencesCodeLens',
                true,
                'csharp.referencesCodeLens.enabled'
            ),
    },
    showTestsCodeLens: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(vscode, 'dotnet.codeLens.enableTestsCodeLens', true, 'csharp.testsCodeLens.enabled'),
    },
    filteredSymbolsCodeLens: {
        getValue: (vscode: vscode) => readOption<string[]>(vscode, 'csharp.referencesCodeLens.filteredSymbols', []),
    },
    disableCodeActions: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'csharp.disableCodeActions', false),
    },
    useSemanticHighlighting: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'csharp.semanticHighlighting.enabled', true),
    },
    inlayHintsEnableForParameters: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.enableInlayHintsForParameters',
                false,
                'csharp.inlayHints.parameters.enabled'
            ),
    },
    inlayHintsForLiteralParameters: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.enableInlayHintsForLiteralParameters',
                false,
                'csharp.inlayHints.parameters.forLiteralParameters'
            ),
    },
    inlayHintsForObjectCreationParameters: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.enableInlayHintsForObjectCreationParameters',
                false,
                'csharp.inlayHints.parameters.forObjectCreationParameters'
            ),
    },
    inlayHintsForIndexerParameters: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.enableInlayHintsForIndexerParameters',
                false,
                'csharp.inlayHints.parameters.forIndexerParameters'
            ),
    },
    inlayHintsForOtherParameters: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.enableInlayHintsForOtherParameters',
                false,
                'csharp.inlayHints.parameters.forOtherParameters'
            ),
    },
    inlayHintsSuppressForParametersThatDifferOnlyBySuffix: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.suppressInlayHintsForParametersThatDifferOnlyBySuffix',
                false,
                'csharp.inlayHints.parameters.suppressForParametersThatDifferOnlyBySuffix'
            ),
    },
    inlayHintsSuppressForParametersThatMatchMethodIntent: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchMethodIntent',
                false,
                'csharp.inlayHints.parameters.suppressForParametersThatMatchMethodIntent'
            ),
    },
    inlayHintsSuppressForParametersThatMatchArgumentName: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchArgumentName',
                false,
                'csharp.inlayHints.parameters.suppressForParametersThatMatchArgumentName'
            ),
    },
    inlayHintsEnableForTypes: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'csharp.inlayHints.enableInlayHintsForTypes',
                false,
                'csharp.inlayHints.types.enabled'
            ),
    },
    inlayHintsForImplicitVariableTypes: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'csharp.inlayHints.enableInlayHintsForImplicitVariableTypes',
                false,
                'csharp.inlayHints.types.forImplicitVariableTypes'
            ),
    },
    inlayHintsForLambdaParameterTypes: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'csharp.inlayHints.enableInlayHintsForLambdaParameterTypes',
                false,
                'csharp.inlayHints.types.forLambdaParameterTypes'
            ),
    },
    inlayHintsForImplicitObjectCreation: {
        getValue: (vscode: vscode) =>
            readOption<boolean>(
                vscode,
                'csharp.inlayHints.enableInlayHintsForImplicitObjectCreation',
                false,
                'csharp.inlayHints.types.forImplicitObjectCreation'
            ),
    },
    maxProjectFileCountForDiagnosticAnalysis: {
        getValue: (vscode: vscode) =>
            readOption<number>(vscode, 'csharp.maxProjectFileCountForDiagnosticAnalysis', 1000),
    },
    suppressDotnetRestoreNotification: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'csharp.suppressDotnetRestoreNotification', false),
    },
    enableLspDriver: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'omnisharp.enableLspDriver', false),
    },
};

export const languageServerOptions: LanguageServerOptionsDefinition = {
    logLevel: {
        getValue: (vscode: vscode) => readOption<string>(vscode, 'dotnet.server.trace', 'Information'),
    },
    documentSelector: {
        getValue: (vscode: vscode) =>
            readOption<DocumentSelector>(vscode, 'dotnet.server.documentSelector', ['csharp']),
    },
    extensionsPaths: {
        getValue: (vscode: vscode) => readOption<string[] | null>(vscode, 'dotnet.server.extensionPaths', null),
    },
};

export const razorOptions: RazorOptionsDefinition = {
    razorDevMode: {
        getValue: (vscode: vscode) => readOption<boolean>(vscode, 'razor.devmode', false),
    },
    razorPluginPath: {
        getValue: (vscode: vscode) => readOption<string>(vscode, 'razor.plugin.path', ''),
    },
};

function getExcludedPaths(vscode: vscode, includeSearchExcludes = false): string[] {
    const workspaceConfig = vscode.workspace.getConfiguration();

    let excludePaths = getExcludes(workspaceConfig, 'files.exclude');

    if (includeSearchExcludes) {
        excludePaths = excludePaths.concat(getExcludes(workspaceConfig, 'search.exclude'));
    }

    return excludePaths;

    function getExcludes(config: WorkspaceConfiguration, option: string): string[] {
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
    vscode: vscode,
    config: WorkspaceConfiguration,
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

function readOption<T>(vscode: vscode, option: string, defaultValue: T, ...backCompatOptionNames: string[]): T {
    return readOptionFromConfig(
        vscode,
        vscode.workspace.getConfiguration(),
        option,
        defaultValue,
        ...backCompatOptionNames
    );
}

export const CommonOptionsThatTriggerReload: ReadonlyArray<keyof CommonOptionsDefinition> = [
    'dotnetPath',
    'waitForDebugger',
    'serverPath',
    'useOmnisharpServer',
];

export const OmnisharpOptionsThatTriggerReload: ReadonlyArray<keyof OmnisharpServerOptionsDefinition> = [
    'enableMsBuildLoadProjectsOnDemand',
    'loggingLevel',
    'enableEditorConfigSupport',
    'enableDecompilationSupport',
    'enableImportCompletion',
    'organizeImportsOnFormat',
    'enableAsyncCompletion',
    'useModernNet',
    'enableLspDriver',
    'sdkPath',
    'sdkVersion',
    'sdkIncludePrereleases',
    'analyzeOpenDocumentsOnly',
    'enableRoslynAnalyzers',
    'inlayHintsEnableForParameters',
    'inlayHintsForLiteralParameters',
    'inlayHintsForObjectCreationParameters',
    'inlayHintsForIndexerParameters',
    'inlayHintsForOtherParameters',
    'inlayHintsSuppressForParametersThatDifferOnlyBySuffix',
    'inlayHintsSuppressForParametersThatMatchMethodIntent',
    'inlayHintsSuppressForParametersThatMatchArgumentName',
    'inlayHintsEnableForTypes',
    'inlayHintsForImplicitVariableTypes',
    'inlayHintsForLambdaParameterTypes',
    'inlayHintsForImplicitObjectCreation',
];

export const LanguageServerOptionsThatTriggerReload: ReadonlyArray<keyof LanguageServerOptionsDefinition> = [
    'logLevel',
    'documentSelector',
];
