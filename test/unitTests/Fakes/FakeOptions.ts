/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../../../src/omnisharp/options";

export function getEmptyOptions(): Options {
    return new Options(
        /* path */"",
        /* useModernNet */false,
        /* useGlobalMono */"",
        /* waitForDebugger */false,
        /* loggingLevel */"",
        /* autoStart */false,
        /* projectLoadTimeout */0,
        /* maxProjectResults */0,
        /* useEditorFormattingSettings */false,
        /* useFormatting */false,
        /* organizeImportsOnFormat */false,
        /* showReferencesCodeLens */false,
        /* showTestsCodeLens */false,
        /* filteredSymbolsCodeLens */undefined,
        /* disableCodeActions */false,
        /* disableMSBuildDiagnosticWarning */false,
        /* showOmnisharpLogOnError */false,
        /* minFindSymbolsFilterLength */0,
        /* maxFindSymbolsItems */0,
        /* razorDisabled */false,
        /* razorDevMode */false,
        /* enableMsBuildLoadProjectsOnDemand */false,
        /* enableRoslynAnalyzers */false,
        /* enableEditorConfigSupport */false,
        /* enableDecompilationSupport */false,
        /* enableImportCompletion */false,
        /* enableAsyncCompletion */false,
        /* analyzeOpenDocumentsOnly */false,
        /* useSemanticHighlighting */false,
        /* inlayHintsEnableForParameters */false,
        /* inlayHintsForLiteralParameters */false,
        /* inlayHintsForObjectCreationParameters */false,
        /* inlayHintsForIndexerParameters */false,
        /* inlayHintsForOtherParameters */false,
        /* inlayHintsSuppressForParametersThatDifferOnlyBySuffix */false,
        /* inlayHintsSuppressForParametersThatMatchMethodIntent */false,
        /* inlayHintsSuppressForParametersThatMatchArgumentName */false,
        /* inlayHintsEnableForTypes */false,
        /* inlayHintsForImplicitVariableTypes */false,
        /* inlayHintsForLambdaParameterTypes */false,
        /* inlayHintsForImplicitObjectCreation */false,
        /* razorPluginPath */"",
        /* defaultLaunchSolution */"",
        /* monoPath */"",
        /* dotnetPath */"",
        /* excludePaths */null,
        /* maxProjectFileCountForDiagnosticAnalysis */null,
        /* testRunSettings */"");
}
