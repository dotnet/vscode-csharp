/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { vscode, WorkspaceConfiguration } from '../vscodeAdapter';

export class Options {
    constructor(
        public path: string,
        public useGlobalMono: string,
        public waitForDebugger: boolean,
        public loggingLevel: string,
        public autoStart: boolean,
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
        public useSemanticHighlighting: boolean,
        public razorPluginPath?: string,
        public defaultLaunchSolution?: string,
        public monoPath?: string,
        public excludePaths?: string[],
        public maxProjectFileCountForDiagnosticAnalysis?: number | null) {
    }

    public static Read(vscode: vscode): Options {
        // Extra effort is taken below to ensure that legacy versions of options
        // are supported below. In particular, these are:
        //
        // - "csharp.omnisharp" -> "omnisharp.path"
        // - "csharp.omnisharpUsesMono" -> "omnisharp.useMono"
        // - "omnisharp.useMono" -> "omnisharp.useGlobalMono"

        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        const csharpConfig = vscode.workspace.getConfiguration('csharp');
        const razorConfig = vscode.workspace.getConfiguration('razor');

        const path = Options.readPathOption(csharpConfig, omnisharpConfig);
        const useGlobalMono = Options.readUseGlobalMonoOption(omnisharpConfig, csharpConfig);
        const monoPath = omnisharpConfig.get<string>('monoPath', undefined) || undefined;

        const waitForDebugger = omnisharpConfig.get<boolean>('waitForDebugger', false);

        // support the legacy "verbose" level as "debug"
        let loggingLevel = omnisharpConfig.get<string>('loggingLevel', 'information');
        if (loggingLevel && loggingLevel.toLowerCase() === 'verbose') {
            loggingLevel = 'debug';
        }

        const autoStart = omnisharpConfig.get<boolean>('autoStart', true);

        const projectLoadTimeout = omnisharpConfig.get<number>('projectLoadTimeout', 60);
        const maxProjectResults = omnisharpConfig.get<number>('maxProjectResults', 250);
        const defaultLaunchSolution = omnisharpConfig.get<string>('defaultLaunchSolution', undefined);
        const useEditorFormattingSettings = omnisharpConfig.get<boolean>('useEditorFormattingSettings', true);

        const enableRoslynAnalyzers = omnisharpConfig.get<boolean>('enableRoslynAnalyzers', false);
        const enableEditorConfigSupport = omnisharpConfig.get<boolean>('enableEditorConfigSupport', false);
        const enableDecompilationSupport = omnisharpConfig.get<boolean>('enableDecompilationSupport', false);
        const enableImportCompletion = omnisharpConfig.get<boolean>('enableImportCompletion', false);
        const enableAsyncCompletion = omnisharpConfig.get<boolean>('enableAsyncCompletion', false);

        const useFormatting = csharpConfig.get<boolean>('format.enable', true);
        const organizeImportsOnFormat = omnisharpConfig.get<boolean>('organizeImportsOnFormat', false);

        const showReferencesCodeLens = csharpConfig.get<boolean>('referencesCodeLens.enabled', true);
        const showTestsCodeLens = csharpConfig.get<boolean>('testsCodeLens.enabled', true);
        const filteredSymbolsCodeLens = csharpConfig.get<string[]>('referencesCodeLens.filteredSymbols', []);

        const useSemanticHighlighting = csharpConfig.get<boolean>('semanticHighlighting.enabled', false);

        const disableCodeActions = csharpConfig.get<boolean>('disableCodeActions', false);

        const disableMSBuildDiagnosticWarning = omnisharpConfig.get<boolean>('disableMSBuildDiagnosticWarning', false);

        const showOmnisharpLogOnError = csharpConfig.get<boolean>('showOmnisharpLogOnError', true);

        const minFindSymbolsFilterLength = omnisharpConfig.get<number>('minFindSymbolsFilterLength', 0);
        const maxFindSymbolsItems = omnisharpConfig.get<number>('maxFindSymbolsItems', 1000);   // The limit is applied only when this setting is set to a number greater than zero

        const enableMsBuildLoadProjectsOnDemand = omnisharpConfig.get<boolean>('enableMsBuildLoadProjectsOnDemand', false);

        const razorDisabled = !!razorConfig && razorConfig.get<boolean>('disabled', false);
        const razorDevMode = !!razorConfig && razorConfig.get<boolean>('devmode', false);
        const razorPluginPath = razorConfig ? razorConfig.get<string>('plugin.path', undefined) : undefined;

        const maxProjectFileCountForDiagnosticAnalysis = csharpConfig.get<number | null>('maxProjectFileCountForDiagnosticAnalysis', 1000);

        const excludePaths = this.getExcludedPaths(vscode);

        return new Options(
            path,
            useGlobalMono,
            waitForDebugger,
            loggingLevel,
            autoStart,
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
            useSemanticHighlighting,
            razorPluginPath,
            defaultLaunchSolution,
            monoPath,
            excludePaths,
            maxProjectFileCountForDiagnosticAnalysis
        );
    }

    public static getExcludedPaths(vscode: vscode, includeSearchExcludes: boolean = false): string[] {
        let workspaceConfig = vscode.workspace.getConfiguration(undefined, null);
        if (!workspaceConfig) {
            return [];
        }

        let excludePaths = getExcludes(workspaceConfig, 'files.exclude');

        if (includeSearchExcludes) {
            excludePaths = excludePaths.concat(getExcludes(workspaceConfig, 'search.exclude'));
        }

        return excludePaths;

        function getExcludes(config: WorkspaceConfiguration, option: string): string[] {
            let optionValue = config.get<{ [i: string]: boolean }>(option);
            if (!optionValue) {
                return [];
            }

            return Object.entries(optionValue)
                .filter(([key, value]) => value)
                .map(([key, value]) => key);
        }
    }

    private static readPathOption(csharpConfig: WorkspaceConfiguration, omnisharpConfig: WorkspaceConfiguration): string | null {
        if (omnisharpConfig.has('path')) {
            // If 'omnisharp.path' setting was found, use it.
            return omnisharpConfig.get<string>('path');
        }
        else if (csharpConfig.has('omnisharp')) {
            // BACKCOMPAT: If 'csharp.omnisharp' setting was found, use it.
            return csharpConfig.get<string>('omnisharp');
        }
        else {
            // Otherwise, null.
            return null;
        }
    }

    private static readUseGlobalMonoOption(omnisharpConfig: WorkspaceConfiguration, csharpConfig: WorkspaceConfiguration): string {
        function toUseGlobalMonoValue(value: boolean): string {
            // True means 'always' and false means 'auto'.
            return value ? "always" : "auto";
        }

        if (omnisharpConfig.has('useGlobalMono')) {
            // If 'omnisharp.useGlobalMono' setting was found, just use it.
            return omnisharpConfig.get<string>('useGlobalMono', "auto");
        }
        else if (omnisharpConfig.has('useMono')) {
            // BACKCOMPAT: If 'omnisharp.useMono' setting was found, true maps to "always" and false maps to "auto"
            return toUseGlobalMonoValue(omnisharpConfig.get<boolean>('useMono'));
        }
        else if (csharpConfig.has('omnisharpUsesMono')) {
            // BACKCOMPAT: If 'csharp.omnisharpUsesMono' setting was found, true maps to "always" and false maps to "auto"
            return toUseGlobalMonoValue(csharpConfig.get<boolean>('omnisharpUsesMono'));
        }
        else {
            // Otherwise, the default value is "auto".
            return "auto";
        }
    }
}
