/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from '../../../src/shared/options';

export function getEmptyOptions(): Options {
    return new Options(
        {
            dotnetPath: '',
            waitForDebugger: false,
            serverPath: '',
            useOmnisharpServer: true,
            excludePaths: [],
            defaultSolution: '',
            unitTestDebuggingOptions: {},
        },
        {
            useModernNet: false,
            monoPath: '',
            loggingLevel: '',
            autoStart: false,
            projectFilesExcludePattern: '',
            projectLoadTimeout: 0,
            maxProjectResults: 0,
            useEditorFormattingSettings: false,
            enableRoslynAnalyzers: false,
            enableEditorConfigSupport: false,
            enableDecompilationSupport: false,
            enableImportCompletion: false,
            enableAsyncCompletion: false,
            analyzeOpenDocumentsOnly: false,
            organizeImportsOnFormat: false,
            disableMSBuildDiagnosticWarning: false,
            showOmnisharpLogOnError: false,
            minFindSymbolsFilterLength: 0,
            maxFindSymbolsItems: 0,
            enableMsBuildLoadProjectsOnDemand: false,
            sdkPath: '',
            sdkVersion: '',
            sdkIncludePrereleases: false,
            testRunSettings: '',
            dotNetCliPaths: [],
            useFormatting: false,
            showReferencesCodeLens: false,
            showTestsCodeLens: false,
            filteredSymbolsCodeLens: [],
            disableCodeActions: false,
            useSemanticHighlighting: false,
            inlayHintsEnableForParameters: false,
            inlayHintsForLiteralParameters: false,
            inlayHintsForObjectCreationParameters: false,
            inlayHintsForIndexerParameters: false,
            inlayHintsForOtherParameters: false,
            inlayHintsSuppressForParametersThatDifferOnlyBySuffix: false,
            inlayHintsSuppressForParametersThatMatchMethodIntent: false,
            inlayHintsSuppressForParametersThatMatchArgumentName: false,
            inlayHintsEnableForTypes: false,
            inlayHintsForImplicitVariableTypes: false,
            inlayHintsForLambdaParameterTypes: false,
            inlayHintsForImplicitObjectCreation: false,
            maxProjectFileCountForDiagnosticAnalysis: 1000,
            suppressDotnetRestoreNotification: false,
        },
        {
            logLevel: '',
            documentSelector: ['csharp'],
            extensionsPaths: null,
        },
        {
            razorDevMode: false,
            razorPluginPath: '',
        }
    );
}
