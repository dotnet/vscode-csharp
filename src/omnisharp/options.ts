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
        public showReferencesCodeLens: boolean,
        public showTestsCodeLens: boolean,
        public disableCodeActions: boolean,
        public disableMSBuildDiagnosticWarning: boolean) { }

    public static Read(vscode: vscode): Options {
        // Extra effort is taken below to ensure that legacy versions of options
        // are supported below. In particular, these are:
        //
        // - "csharp.omnisharp" -> "omnisharp.path"
        // - "csharp.omnisharpUsesMono" -> "omnisharp.useMono"
        // - "omnisharp.useMono" -> "omnisharp.useGlobalMono"

        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        const csharpConfig = vscode.workspace.getConfiguration('csharp');

        const path = Options.readPathOption(csharpConfig, omnisharpConfig);
        const useGlobalMono = Options.readUseGlobalMonoOption(omnisharpConfig, csharpConfig);

        const waitForDebugger = omnisharpConfig.get<boolean>('waitForDebugger', false);

        // support the legacy "verbose" level as "debug"
        let loggingLevel = omnisharpConfig.get<string>('loggingLevel', 'information');
        if (loggingLevel && loggingLevel.toLowerCase() === 'verbose') {
            loggingLevel = 'debug';
        }

        const autoStart = omnisharpConfig.get<boolean>('autoStart', true);

        const projectLoadTimeout = omnisharpConfig.get<number>('projectLoadTimeout', 60);
        const maxProjectResults = omnisharpConfig.get<number>('maxProjectResults', 250);
        const useEditorFormattingSettings = omnisharpConfig.get<boolean>('useEditorFormattingSettings', true);

        const useFormatting = csharpConfig.get<boolean>('format.enable', true);

        const showReferencesCodeLens = csharpConfig.get<boolean>('referencesCodeLens.enabled', true);
        const showTestsCodeLens = csharpConfig.get<boolean>('testsCodeLens.enabled', true);

        const disableCodeActions = csharpConfig.get<boolean>('disableCodeActions', false);

        const disableMSBuildDiagnosticWarning = omnisharpConfig.get<boolean>('disableMSBuildDiagnosticWarning', false);

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
            showReferencesCodeLens,
            showTestsCodeLens,
            disableCodeActions,
            disableMSBuildDiagnosticWarning);
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