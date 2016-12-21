/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class Options {
    constructor(
        public path?: string,
        public useMono?: boolean,
        public loggingLevel?: string,
        public autoStart?: boolean,
        public projectLoadTimeout?: number,
        public maxProjectResults?: number,
        public useEditorFormattingSettings?: boolean) { }

    public static Read(): Options {
        // Extra effort is taken below to ensure that legacy versions of options
        // are supported below. In particular, these are:
        //
        // - "csharp.omnisharp" -> "omnisharp.path"
        // - "csharp.omnisharpUsesMono" -> "omnisharp.useMono"

        const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
        const csharpConfig = vscode.workspace.getConfiguration('csharp');

        const path = csharpConfig.has('omnisharp')
            ? csharpConfig.get<string>('omnisharp')
            : omnisharpConfig.get<string>('path');

        const useMono = csharpConfig.has('omnisharpUsesMono')
            ? csharpConfig.get<boolean>('omnisharpUsesMono')
            : omnisharpConfig.get<boolean>('useMono');

        const loggingLevel = omnisharpConfig.get<string>('loggingLevel');
        const autoStart = omnisharpConfig.get<boolean>('autoStart', true);

        const projectLoadTimeout = omnisharpConfig.get<number>('projectLoadTimeout', 60);
        const maxProjectResults = omnisharpConfig.get<number>('maxProjectResults', 250);
        const useEditorFormattingSettings = omnisharpConfig.get<boolean>('useEditorFormattingSettings', true);

        return new Options(path, useMono, loggingLevel, autoStart, projectLoadTimeout, maxProjectResults, useEditorFormattingSettings);
    }
}