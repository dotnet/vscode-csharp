/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode, WorkspaceConfiguration } from '../vscodeAdapter';

export class Options {
    constructor(
        public path: string,
        public useModernNet: boolean,
        public waitForDebugger: boolean,
        public loggingLevel: string,
        public autoStart: boolean,
        public projectFilesExcludePattern: string,
        public projectLoadTimeout: number,
        public maxProjectResults: number,
        public useEditorFormattingSettings: boolean,
        public useFormatting: boolean,
        public organizeImportsOnFormat: boolean,
        public showReferencesCodeLens: boolean,
        public showTestsCodeLens: boolean,
        public filteredSymbolsCodeLens: string[],
        public disableCodeActions: boolean,
        public disableMSBuildDiagnosticWarning: boolean,
        public showOmnisharpLogOnError: boolean,
        public minFindSymbolsFilterLength: number,
        public maxFindSymbolsItems: number,
        public razorDisabled: boolean,
        public razorDevMode: boolean,
        public enableMsBuildLoadProjectsOnDemand: boolean,
        public enableRoslynAnalyzers: boolean,
        public enableEditorConfigSupport: boolean,
        public enableDecompilationSupport: boolean,
        public enableImportCompletion: boolean,
        public enableAsyncCompletion: boolean,
        public analyzeOpenDocumentsOnly: boolean,
        public useSemanticHighlighting: boolean,
        public inlayHintsEnableForParameters: boolean,
        public inlayHintsForLiteralParameters: boolean,
        public inlayHintsForObjectCreationParameters: boolean,
        public inlayHintsForIndexerParameters: boolean,
        public inlayHintsForOtherParameters: boolean,
        public inlayHintsSuppressForParametersThatDifferOnlyBySuffix: boolean,
        public inlayHintsSuppressForParametersThatMatchMethodIntent: boolean,
        public inlayHintsSuppressForParametersThatMatchArgumentName: boolean,
        public inlayHintsEnableForTypes: boolean,
        public inlayHintsForImplicitVariableTypes: boolean,
        public inlayHintsForLambdaParameterTypes: boolean,
        public inlayHintsForImplicitObjectCreation: boolean,
        public sdkPath: string,
        public sdkVersion: string,
        public sdkIncludePrereleases: boolean,
        public razorPluginPath: string,
        public defaultLaunchSolution: string,
        public monoPath: string,
        public dotnetPath: string,
        public excludePaths: string[],
        public maxProjectFileCountForDiagnosticAnalysis: number,
        public testRunSettings: string,
        public dotNetCliPaths: string[],
        public enableLspDriver?: boolean | null) {
    }

    public static Read(vscode: vscode): Options {
        // Extra effort is taken below to ensure that legacy versions of options
        // are supported below. In particular, these are:
        //
        // - "csharp.omnisharp" -> "omnisharp.path"

        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        const csharpConfig = vscode.workspace.getConfiguration('csharp');
        const razorConfig = vscode.workspace.getConfiguration('razor');

        const path = Options.readPathOption(csharpConfig, omnisharpConfig);
        const useModernNet = omnisharpConfig.get<boolean>("useModernNet", true);

        const sdkPath = omnisharpConfig.get<string>('sdkPath', '');
        const sdkVersion = omnisharpConfig.get<string>('sdkVersion', '');
        const sdkIncludePrereleases = omnisharpConfig.get<boolean>('sdkIncludePrereleases', true);

        // VS Code coerces unset string settings to the empty string.
        // Thus, to avoid dealing with the empty string AND undefined,
        // explicitly pass in the empty string as the fallback if the setting
        // isn't defined in package.json (which should never happen).
        const monoPath = omnisharpConfig.get<string>('monoPath', '');
        const dotnetPath = omnisharpConfig.get<string>('dotnetPath', '');

        const waitForDebugger = omnisharpConfig.get<boolean>('waitForDebugger', false);

        // support the legacy "verbose" level as "debug"
        let loggingLevel = omnisharpConfig.get<string>('loggingLevel', 'information');
        if (loggingLevel && loggingLevel.toLowerCase() === 'verbose') {
            loggingLevel = 'debug';
        }

        const autoStart = omnisharpConfig.get<boolean>('autoStart', true);

        const projectFilesExcludePattern = omnisharpConfig.get<string>('projectFilesExcludePattern', '**/node_modules/**,**/.git/**,**/bower_components/**');
        const projectLoadTimeout = omnisharpConfig.get<number>('projectLoadTimeout', 60);
        const maxProjectResults = omnisharpConfig.get<number>('maxProjectResults', 250);
        const defaultLaunchSolution = omnisharpConfig.get<string>('defaultLaunchSolution', '');
        const useEditorFormattingSettings = omnisharpConfig.get<boolean>('useEditorFormattingSettings', true);

        const enableRoslynAnalyzers = omnisharpConfig.get<boolean>('enableRoslynAnalyzers', false);
        const enableEditorConfigSupport = omnisharpConfig.get<boolean>('enableEditorConfigSupport', true);
        const enableDecompilationSupport = omnisharpConfig.get<boolean>('enableDecompilationSupport', false);
        const enableLspDriver = omnisharpConfig.get<boolean>('enableLspDriver', false);
        const enableImportCompletion = omnisharpConfig.get<boolean>('enableImportCompletion', false);
        const enableAsyncCompletion = omnisharpConfig.get<boolean>('enableAsyncCompletion', false);
        const analyzeOpenDocumentsOnly = omnisharpConfig.get<boolean>('analyzeOpenDocumentsOnly', false);

        const useFormatting = csharpConfig.get<boolean>('format.enable', true);
        const organizeImportsOnFormat = omnisharpConfig.get<boolean>('organizeImportsOnFormat', false);

        const showReferencesCodeLens = csharpConfig.get<boolean>('referencesCodeLens.enabled', true);
        const showTestsCodeLens = csharpConfig.get<boolean>('testsCodeLens.enabled', true);
        const filteredSymbolsCodeLens = csharpConfig.get<string[]>('referencesCodeLens.filteredSymbols', []);

        const useSemanticHighlighting = csharpConfig.get<boolean>('semanticHighlighting.enabled', true);

        const inlayHintsEnableForParameters = csharpConfig.get<boolean>('inlayHints.parameters.enabled', false);
        const inlayHintsForLiteralParameters = csharpConfig.get<boolean>('inlayHints.parameters.forLiteralParameters', false);
        const inlayHintsForObjectCreationParameters = csharpConfig.get<boolean>('inlayHints.parameters.forObjectCreationParameters', false);
        const inlayHintsForIndexerParameters = csharpConfig.get<boolean>('inlayHints.parameters.forIndexerParameters', false);
        const inlayHintsForOtherParameters = csharpConfig.get<boolean>('inlayHints.parameters.forOtherParameters', false);
        const inlayHintsSuppressForParametersThatDifferOnlyBySuffix = csharpConfig.get<boolean>('inlayHints.parameters.suppressForParametersThatDifferOnlyBySuffix', false);
        const inlayHintsSuppressForParametersThatMatchMethodIntent = csharpConfig.get<boolean>('inlayHints.parameters.suppressForParametersThatMatchMethodIntent', false);
        const inlayHintsSuppressForParametersThatMatchArgumentName = csharpConfig.get<boolean>('inlayHints.parameters.suppressForParametersThatMatchArgumentName', false);
        const inlayHintsEnableForTypes = csharpConfig.get<boolean>('inlayHints.types.enabled', false);
        const inlayHintsForImplicitVariableTypes = csharpConfig.get<boolean>('inlayHints.types.forImplicitVariableTypes', false);
        const inlayHintsForLambdaParameterTypes = csharpConfig.get<boolean>('inlayHints.types.forLambdaParameterTypes', false);
        const inlayHintsForImplicitObjectCreation = csharpConfig.get<boolean>('inlayHints.types.forImplicitObjectCreation', false);

        const disableCodeActions = csharpConfig.get<boolean>('disableCodeActions', false);

        const disableMSBuildDiagnosticWarning = omnisharpConfig.get<boolean>('disableMSBuildDiagnosticWarning', false);

        const showOmnisharpLogOnError = csharpConfig.get<boolean>('showOmnisharpLogOnError', true);

        const minFindSymbolsFilterLength = omnisharpConfig.get<number>('minFindSymbolsFilterLength', 0);
        const maxFindSymbolsItems = omnisharpConfig.get<number>('maxFindSymbolsItems', 1000);   // The limit is applied only when this setting is set to a number greater than zero

        const enableMsBuildLoadProjectsOnDemand = omnisharpConfig.get<boolean>('enableMsBuildLoadProjectsOnDemand', false);

        const razorDisabled = razorConfig?.get<boolean>('disabled', false) ?? false;
        const razorDevMode = razorConfig?.get<boolean>('devmode', false) ?? false;
        const razorPluginPath = razorConfig?.get<string>('plugin.path', '') ?? '';

        const maxProjectFileCountForDiagnosticAnalysis = csharpConfig.get<number>('maxProjectFileCountForDiagnosticAnalysis', 1000);

        const testRunSettings = omnisharpConfig.get<string>('testRunSettings', '');

        const excludePaths = this.getExcludedPaths(vscode);

        const dotNetCliPaths = omnisharpConfig.get<string[]>('dotNetCliPaths', []);

        return new Options(
            path,
            useModernNet,
            waitForDebugger,
            loggingLevel,
            autoStart,
            projectFilesExcludePattern,
            projectLoadTimeout,
            maxProjectResults,
            useEditorFormattingSettings,
            useFormatting,
            organizeImportsOnFormat,
            showReferencesCodeLens,
            showTestsCodeLens,
            filteredSymbolsCodeLens,
            disableCodeActions,
            disableMSBuildDiagnosticWarning,
            showOmnisharpLogOnError,
            minFindSymbolsFilterLength,
            maxFindSymbolsItems,
            razorDisabled,
            razorDevMode,
            enableMsBuildLoadProjectsOnDemand,
            enableRoslynAnalyzers,
            enableEditorConfigSupport,
            enableDecompilationSupport,
            enableImportCompletion,
            enableAsyncCompletion,
            analyzeOpenDocumentsOnly,
            useSemanticHighlighting,
            inlayHintsEnableForParameters,
            inlayHintsForLiteralParameters,
            inlayHintsForObjectCreationParameters,
            inlayHintsForIndexerParameters,
            inlayHintsForOtherParameters,
            inlayHintsSuppressForParametersThatDifferOnlyBySuffix,
            inlayHintsSuppressForParametersThatMatchMethodIntent,
            inlayHintsSuppressForParametersThatMatchArgumentName,
            inlayHintsEnableForTypes,
            inlayHintsForImplicitVariableTypes,
            inlayHintsForLambdaParameterTypes,
            inlayHintsForImplicitObjectCreation,
            sdkPath,
            sdkVersion,
            sdkIncludePrereleases,
            razorPluginPath,
            defaultLaunchSolution,
            monoPath,
            dotnetPath,
            excludePaths,
            maxProjectFileCountForDiagnosticAnalysis,
            testRunSettings,
            dotNetCliPaths,
            enableLspDriver
        );
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

    private static readPathOption(csharpConfig: WorkspaceConfiguration, omnisharpConfig: WorkspaceConfiguration): string {
        if (omnisharpConfig.has('path')) {
            // If 'omnisharp.path' setting was found, use it.
            return omnisharpConfig.get<string>('path', '');
        }
        else if (csharpConfig.has('omnisharp')) {
            // BACKCOMPAT: If 'csharp.omnisharp' setting was found, use it.
            return csharpConfig.get<string>('omnisharp', '');
        }
        else {
            // Otherwise, the empty string.
            return '';
        }
    }
}
