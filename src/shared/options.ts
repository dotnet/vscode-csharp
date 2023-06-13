/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isDeepStrictEqual } from 'util';
import { DocumentSelector } from 'vscode-languageserver-protocol';
import { vscode, WorkspaceConfiguration } from '../vscodeAdapter';
import * as path from 'path';

export class Options {
    constructor(
        public commonOptions: CommonOptions,
        public omnisharpOptions: OmnisharpServerOptions,
        public languageServerOptions: LanguageServerOptions,
        public razorOptions: RazorOptions) {
    }

    public static Read(vscode: vscode): Options {
        // Extra effort is taken below to ensure that legacy versions of options
        // are supported below. In particular, these are:
        //
        // - "csharp.omnisharp" -> "omnisharp.path"
        // - "omnisharp.XYZ" -> "dotnet.XYZ" (for options that apply to either server)

        const config = vscode.workspace.getConfiguration();

        // Common options shared between O# and Roslyn

        // VS Code coerces unset string settings to the empty string.
        // Thus, to avoid dealing with the empty string AND undefined,
        // explicitly pass in the empty string as the fallback if the setting
        // isn't defined in package.json (which should never happen).
        const dotnetPath = Options.readOption<string>(config, 'dotnet.dotnetPath', '', 'omnisharp.dotnetPath');
        const serverPath = Options.readOption<string>(config, 'dotnet.server.path', '', 'omnisharp.path', 'csharp.omnisharp');
        const waitForDebugger = Options.readOption<boolean>(config, 'dotnet.server.waitForDebugger', false, 'omnisharp.waitForDebugger');
        const useOmnisharpServer = Options.readOption<boolean>(config, 'dotnet.server.useOmnisharp', false);

        let defaultSolution = '';

        const defaultSolutionFromWorkspace = Options.readOption<string>(config, 'dotnet.defaultSolution', '', 'omnisharp.defaultLaunchSolution');

        // If the workspace has defaultSolution disabled, just be done
        if (defaultSolutionFromWorkspace === "disable") {
            defaultSolution = "disable";
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
                if(defaultSolution == '') {
                    for (let workspaceFolder of vscode.workspace.workspaceFolders) {
                        const workspaceFolderConfig = vscode.workspace.getConfiguration(undefined, workspaceFolder.uri);
                        const defaultSolutionFromWorkspaceFolder = Options.readOption<string>(workspaceFolderConfig, 'dotnet.defaultSolution', '', 'omnisharp.defaultLaunchSolution');
                        if (defaultSolutionFromWorkspaceFolder !== '' && defaultSolutionFromWorkspaceFolder !== "disable") {
                            defaultSolution = path.join(workspaceFolder.uri.fsPath, defaultSolutionFromWorkspaceFolder);
                            break;
                        }
                    }
                }
            }
        }

        // Omnisharp Server Options

        const monoPath = Options.readOption<string>(config, 'omnisharp.monoPath', '');

        // support the legacy "verbose" level as "debug"
        let loggingLevel = Options.readOption<string>(config, 'omnisharp.loggingLevel', 'information');
        if (loggingLevel && loggingLevel.toLowerCase() === 'verbose') {
            loggingLevel = 'debug';
        }

        const useModernNet = Options.readOption<boolean>(config, 'omnisharp.useModernNet', true);
        const sdkPath = Options.readOption<string>(config, 'omnisharp.sdkPath', '');
        const sdkVersion = Options.readOption<string>(config, 'omnisharp.sdkVersion', '');
        const sdkIncludePrereleases = Options.readOption<boolean>(config, 'omnisharp.sdkIncludePrereleases', true);
        const autoStart = Options.readOption<boolean>(config, 'omnisharp.autoStart', true);
        const projectFilesExcludePattern = Options.readOption<string>(config, 'omnisharp.projectFilesExcludePattern', '**/node_modules/**,**/.git/**,**/bower_components/**');
        const projectLoadTimeout = Options.readOption<number>(config, 'omnisharp.projectLoadTimeout', 60);
        const maxProjectResults = Options.readOption<number>(config, 'omnisharp.maxProjectResults', 250);
        const useEditorFormattingSettings = Options.readOption<boolean>(config, 'omnisharp.useEditorFormattingSettings', true);
        const enableRoslynAnalyzers = Options.readOption<boolean>(config, 'omnisharp.enableRoslynAnalyzers', false);
        const enableEditorConfigSupport = Options.readOption<boolean>(config, 'omnisharp.enableEditorConfigSupport', true);
        const enableDecompilationSupport = Options.readOption<boolean>(config, 'omnisharp.enableDecompilationSupport', false);
        const enableLspDriver = Options.readOption<boolean>(config, 'omnisharp.enableLspDriver', false);
        const enableImportCompletion = Options.readOption<boolean>(config, 'dotnet.completion.showCompletionItemsFromUnimportedNamespaces', false, 'omnisharp.enableImportCompletion');
        const enableAsyncCompletion = Options.readOption<boolean>(config, 'omnisharp.enableAsyncCompletion', false);
        const analyzeOpenDocumentsOnly = Options.readOption<boolean>(config, 'omnisharp.analyzeOpenDocumentsOnly', false);
        const organizeImportsOnFormat = Options.readOption<boolean>(config, 'omnisharp.organizeImportsOnFormat', false);
        const disableMSBuildDiagnosticWarning = Options.readOption<boolean>(config, 'omnisharp.disableMSBuildDiagnosticWarning', false);
        const minFindSymbolsFilterLength = Options.readOption<number>(config, 'omnisharp.minFindSymbolsFilterLength', 0);
        const maxFindSymbolsItems = Options.readOption<number>(config, 'omnisharp.maxFindSymbolsItems', 1000);   // The limit is applied only when this setting is set to a number greater than zero
        const enableMsBuildLoadProjectsOnDemand = Options.readOption<boolean>(config, 'omnisharp.enableMsBuildLoadProjectsOnDemand', false);
        const testRunSettings = Options.readOption<string>(config, 'omnisharp.testRunSettings', '');
        const dotNetCliPaths = Options.readOption<string[]>(config, 'omnisharp.dotNetCliPaths', []);

        const useFormatting = Options.readOption<boolean>(config, 'csharp.format.enable', true);
        const showReferencesCodeLens = Options.readOption<boolean>(config, 'csharp.referencesCodeLens.enabled', true);
        const showTestsCodeLens = Options.readOption<boolean>(config, 'csharp.testsCodeLens.enabled', true);
        const filteredSymbolsCodeLens = Options.readOption<string[]>(config, 'csharp.referencesCodeLens.filteredSymbols', []);
        const useSemanticHighlighting = Options.readOption<boolean>(config, 'csharp.semanticHighlighting.enabled', true);
        const inlayHintsEnableForParameters = Options.readOption<boolean>(config, 'dotnet.inlayHints.enableInlayHintsForParameters', false, 'csharp.inlayHints.parameters.enabled');
        const inlayHintsForLiteralParameters = Options.readOption<boolean>(config, 'dotnet.inlayHints.enableInlayHintsForLiteralParameters', false, 'csharp.inlayHints.parameters.forLiteralParameters');
        const inlayHintsForObjectCreationParameters = Options.readOption<boolean>(config, 'dotnet.inlayHints.enableInlayHintsForObjectCreationParameters', false, 'csharp.inlayHints.parameters.forObjectCreationParameters');
        const inlayHintsForIndexerParameters = Options.readOption<boolean>(config, 'dotnet.inlayHints.enableInlayHintsForIndexerParameters', false, 'csharp.inlayHints.parameters.forIndexerParameters');
        const inlayHintsForOtherParameters = Options.readOption<boolean>(config, 'dotnet.inlayHints.enableInlayHintsForOtherParameters', false, 'csharp.inlayHints.parameters.forOtherParameters');
        const inlayHintsSuppressForParametersThatDifferOnlyBySuffix = Options.readOption<boolean>(config, 'dotnet.inlayHints.suppressInlayHintsForParametersThatDifferOnlyBySuffix', false, 'csharp.inlayHints.parameters.suppressForParametersThatDifferOnlyBySuffix');
        const inlayHintsSuppressForParametersThatMatchMethodIntent = Options.readOption<boolean>(config, 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchMethodIntent', false, 'csharp.inlayHints.parameters.suppressForParametersThatMatchMethodIntent');
        const inlayHintsSuppressForParametersThatMatchArgumentName = Options.readOption<boolean>(config, 'dotnet.inlayHints.suppressInlayHintsForParametersThatMatchArgumentName', false, 'csharp.inlayHints.parameters.suppressForParametersThatMatchArgumentName');
        const inlayHintsEnableForTypes = Options.readOption<boolean>(config, 'csharp.inlayHints.enableInlayHintsForTypes', false, 'csharp.inlayHints.types.enabled');
        const inlayHintsForImplicitVariableTypes = Options.readOption<boolean>(config, 'csharp.inlayHints.enableInlayHintsForImplicitVariableTypes', false, 'csharp.inlayHints.types.forImplicitVariableTypes');
        const inlayHintsForLambdaParameterTypes = Options.readOption<boolean>(config, 'csharp.inlayHints.enableInlayHintsForLambdaParameterTypes', false, 'csharp.inlayHints.types.forLambdaParameterTypes');
        const inlayHintsForImplicitObjectCreation = Options.readOption<boolean>(config, 'csharp.inlayHints.enableInlayHintsForImplicitObjectCreation', false, 'csharp.inlayHints.types.forImplicitObjectCreation');
        const disableCodeActions = Options.readOption<boolean>(config, 'csharp.disableCodeActions', false);
        const showOmnisharpLogOnError = Options.readOption<boolean>(config, 'csharp.showOmnisharpLogOnError', true);
        const maxProjectFileCountForDiagnosticAnalysis = Options.readOption<number>(config, 'csharp.maxProjectFileCountForDiagnosticAnalysis', 1000);
        const suppressDotnetRestoreNotification = Options.readOption<boolean>(config, 'csharp.suppressDotnetRestoreNotification', false);

        // Options for MS.CA.LanguageServer
        let languageServerLogLevel = Options.readOption<string>(config, 'dotnet.server.trace', 'Information');
        let documentSelector = Options.readOption<DocumentSelector>(config, 'dotnet.server.documentSelector', ['csharp']);
        let extensionPaths = Options.readOption<string[] | null>(config, 'dotnet.server.extensionPaths', null);

        // Options that apply to Razor
        const razorDevMode = Options.readOption<boolean>(config, 'razor.devmode', false) ?? false;
        const razorPluginPath = Options.readOption<string>(config, 'razor.plugin.path', '') ?? '';

        const excludePaths = this.getExcludedPaths(vscode);

        return new Options({
                dotnetPath: dotnetPath,
                waitForDebugger: waitForDebugger,
                serverPath: serverPath,
                useOmnisharpServer: useOmnisharpServer,
                excludePaths: excludePaths,
                defaultSolution: defaultSolution,
            },
            {
                useModernNet: useModernNet,
                monoPath: monoPath,
                loggingLevel: loggingLevel,
                autoStart: autoStart,
                projectFilesExcludePattern: projectFilesExcludePattern,
                projectLoadTimeout: projectLoadTimeout,
                maxProjectResults: maxProjectResults,
                useEditorFormattingSettings: useEditorFormattingSettings,
                enableRoslynAnalyzers: enableRoslynAnalyzers,
                enableEditorConfigSupport: enableEditorConfigSupport,
                enableDecompilationSupport: enableDecompilationSupport,
                enableImportCompletion: enableImportCompletion,
                enableAsyncCompletion: enableAsyncCompletion,
                analyzeOpenDocumentsOnly: analyzeOpenDocumentsOnly,
                organizeImportsOnFormat: organizeImportsOnFormat,
                disableMSBuildDiagnosticWarning: disableMSBuildDiagnosticWarning,
                showOmnisharpLogOnError: showOmnisharpLogOnError,
                minFindSymbolsFilterLength: minFindSymbolsFilterLength,
                maxFindSymbolsItems: maxFindSymbolsItems,
                enableMsBuildLoadProjectsOnDemand: enableMsBuildLoadProjectsOnDemand,
                sdkPath: sdkPath,
                sdkVersion: sdkVersion,
                sdkIncludePrereleases: sdkIncludePrereleases,
                testRunSettings: testRunSettings,
                dotNetCliPaths: dotNetCliPaths,
                useFormatting: useFormatting,
                showReferencesCodeLens: showReferencesCodeLens,
                showTestsCodeLens: showTestsCodeLens,
                filteredSymbolsCodeLens: filteredSymbolsCodeLens,
                disableCodeActions: disableCodeActions,
                useSemanticHighlighting: useSemanticHighlighting,
                inlayHintsEnableForParameters: inlayHintsEnableForParameters,
                inlayHintsForLiteralParameters: inlayHintsForLiteralParameters,
                inlayHintsForObjectCreationParameters: inlayHintsForObjectCreationParameters,
                inlayHintsForIndexerParameters: inlayHintsForIndexerParameters,
                inlayHintsForOtherParameters: inlayHintsForOtherParameters,
                inlayHintsSuppressForParametersThatDifferOnlyBySuffix: inlayHintsSuppressForParametersThatDifferOnlyBySuffix,
                inlayHintsSuppressForParametersThatMatchMethodIntent: inlayHintsSuppressForParametersThatMatchMethodIntent,
                inlayHintsSuppressForParametersThatMatchArgumentName: inlayHintsSuppressForParametersThatMatchArgumentName,
                inlayHintsEnableForTypes: inlayHintsEnableForTypes,
                inlayHintsForImplicitVariableTypes: inlayHintsForImplicitVariableTypes,
                inlayHintsForLambdaParameterTypes: inlayHintsForLambdaParameterTypes,
                inlayHintsForImplicitObjectCreation: inlayHintsForImplicitObjectCreation,
                maxProjectFileCountForDiagnosticAnalysis: maxProjectFileCountForDiagnosticAnalysis,
                suppressDotnetRestoreNotification: suppressDotnetRestoreNotification,
                enableLspDriver: enableLspDriver,
            },
            {
                logLevel: languageServerLogLevel,
                documentSelector: documentSelector,
                extensionsPaths: extensionPaths
            },
            {
                razorDevMode: razorDevMode,
                razorPluginPath: razorPluginPath
            }
        );
    }

    public static shouldOmnisharpOptionChangeTriggerReload(oldOptions: Options, newOptions: Options): boolean {
        const commonOptionsChanged = CommonOptionsThatTriggerReload.some(key => !isDeepStrictEqual(oldOptions.commonOptions[key], newOptions.commonOptions[key]));
        const omnisharpOptionsChanged = OmnisharpOptionsThatTriggerReload.some(key => !isDeepStrictEqual(oldOptions.omnisharpOptions[key], newOptions.omnisharpOptions[key]));
        return commonOptionsChanged || omnisharpOptionsChanged;
    }

    public static shouldLanguageServerOptionChangeTriggerReload(oldOptions: Options, newOptions: Options): boolean {
        const commonOptionsChanged = CommonOptionsThatTriggerReload.some(key => !isDeepStrictEqual(oldOptions.commonOptions[key], newOptions.commonOptions[key]));
        const languageServerOptionsChanged = LanguageServerOptionsThatTriggerReload.some(key => !isDeepStrictEqual(oldOptions.languageServerOptions[key], newOptions.languageServerOptions[key]));
        return commonOptionsChanged || languageServerOptionsChanged;

    }

    public static getExcludedPaths(vscode: vscode, includeSearchExcludes: boolean = false): string[] {
        const workspaceConfig = vscode.workspace.getConfiguration();

        let excludePaths = getExcludes(workspaceConfig, 'files.exclude');

        if (includeSearchExcludes) {
            excludePaths = excludePaths.concat(getExcludes(workspaceConfig, 'search.exclude'));
        }

        return excludePaths;

        function getExcludes(config: WorkspaceConfiguration, option: string): string[] {
            const optionValue = config.get<{ [i: string]: boolean }>(option, {});
            return Object.entries(optionValue)
                .filter(([key, value]) => value)
                .map(([key, value]) => key);
        }
    }

    /**
     * Reads an option from the vscode config with an optional back compat parameter.
     */
    private static readOption<T>(config: WorkspaceConfiguration, option: string, defaultValue: T, ...backCompatOptionNames: string[]): T {
        let value = config.get<T>(option);

        if (value === undefined && backCompatOptionNames.length > 0) {
            // Search the back compat options for a defined value.
            value = backCompatOptionNames.map((name) => config.get<T>(name)).find((val) => val);
        }

        return value ?? defaultValue;
    }
}

export interface CommonOptions {
    dotnetPath: string;
    waitForDebugger: boolean;
    serverPath: string;
    useOmnisharpServer: boolean;
    excludePaths: string[];

    /** The default solution; this has been normalized to a full file path from the workspace folder it was configured in, or the string "disable" if that has been disabled */
    defaultSolution: string;
}

const CommonOptionsThatTriggerReload: ReadonlyArray<keyof CommonOptions> = [
    "dotnetPath",
    "waitForDebugger",
    "serverPath",
    "useOmnisharpServer",
];

export interface OmnisharpServerOptions {
    useModernNet: boolean;
    monoPath: string;
    loggingLevel: string;
    autoStart: boolean;
    projectFilesExcludePattern: string;
    projectLoadTimeout: number;
    maxProjectResults: number;
    useEditorFormattingSettings: boolean;
    enableRoslynAnalyzers: boolean;
    enableEditorConfigSupport: boolean;
    enableDecompilationSupport: boolean;
    enableImportCompletion: boolean;
    enableAsyncCompletion: boolean;
    analyzeOpenDocumentsOnly: boolean;
    organizeImportsOnFormat: boolean;
    disableMSBuildDiagnosticWarning: boolean;
    showOmnisharpLogOnError: boolean;
    minFindSymbolsFilterLength: number;
    maxFindSymbolsItems: number;
    enableMsBuildLoadProjectsOnDemand: boolean;
    sdkPath: string;
    sdkVersion: string;
    sdkIncludePrereleases: boolean;
    testRunSettings: string;
    dotNetCliPaths: string[];
    useFormatting: boolean;
    showReferencesCodeLens: boolean;
    showTestsCodeLens: boolean;
    filteredSymbolsCodeLens: string[];
    disableCodeActions: boolean;
    useSemanticHighlighting: boolean;
    inlayHintsEnableForParameters: boolean;
    inlayHintsForLiteralParameters: boolean;
    inlayHintsForObjectCreationParameters: boolean;
    inlayHintsForIndexerParameters: boolean;
    inlayHintsForOtherParameters: boolean;
    inlayHintsSuppressForParametersThatDifferOnlyBySuffix: boolean;
    inlayHintsSuppressForParametersThatMatchMethodIntent: boolean;
    inlayHintsSuppressForParametersThatMatchArgumentName: boolean;
    inlayHintsEnableForTypes: boolean;
    inlayHintsForImplicitVariableTypes: boolean;
    inlayHintsForLambdaParameterTypes: boolean;
    inlayHintsForImplicitObjectCreation: boolean;
    maxProjectFileCountForDiagnosticAnalysis: number;
    suppressDotnetRestoreNotification: boolean;
    enableLspDriver?: boolean | null;
}

const OmnisharpOptionsThatTriggerReload: ReadonlyArray<keyof OmnisharpServerOptions> = [
    "enableMsBuildLoadProjectsOnDemand",
    "loggingLevel",
    "enableEditorConfigSupport",
    "enableDecompilationSupport",
    "enableImportCompletion",
    "organizeImportsOnFormat",
    "enableAsyncCompletion",
    "useModernNet",
    "enableLspDriver",
    "sdkPath",
    "sdkVersion",
    "sdkIncludePrereleases",
    "analyzeOpenDocumentsOnly",
    "enableRoslynAnalyzers",
    "inlayHintsEnableForParameters",
    "inlayHintsForLiteralParameters",
    "inlayHintsForObjectCreationParameters",
    "inlayHintsForIndexerParameters",
    "inlayHintsForOtherParameters",
    "inlayHintsSuppressForParametersThatDifferOnlyBySuffix",
    "inlayHintsSuppressForParametersThatMatchMethodIntent",
    "inlayHintsSuppressForParametersThatMatchArgumentName",
    "inlayHintsEnableForTypes",
    "inlayHintsForImplicitVariableTypes",
    "inlayHintsForLambdaParameterTypes",
    "inlayHintsForImplicitObjectCreation",
];

export interface RazorOptions {
    razorDevMode: boolean;
    razorPluginPath: string;
}

export interface LanguageServerOptions {
    logLevel: string;
    documentSelector: DocumentSelector;
    extensionsPaths: string[] | null;
}

const LanguageServerOptionsThatTriggerReload: ReadonlyArray<keyof LanguageServerOptions> = [
    "logLevel",
    "documentSelector"
];
