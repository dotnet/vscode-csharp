/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';

export interface Options {
    path?: string;
    useMono?: boolean;
    loggingLevel?: string;
    autoStart?: boolean;
}

export function readOptions(): Options {
    // Extra effort is taken below to ensure that legacy versions of options
    // are supported below. In particular, these are:
    //
    // - "csharp.omnisharp" -> "omnisharp.path"
    // - "csharp.omnisharpUsesMono" -> "omnisharp.useMono"

    const omnisharpConfig = vscode.workspace.getConfiguration('omnisharp');
    const csharpConfig = vscode.workspace.getConfiguration('csharp');

    const path = omnisharpConfig.has('path')
        ? omnisharpConfig.get<string>('path')
        : csharpConfig.get<string>('omnisharp');

    const useMono = omnisharpConfig.has('useMono')
        ? omnisharpConfig.get<boolean>('useMono')
        : csharpConfig.get<boolean>('omnisharpUsesMono');

    const loggingLevel = omnisharpConfig.get<string>('loggingLevel');
    const autoStart = omnisharpConfig.get<boolean>('autoStart', true);

    return { path, useMono, loggingLevel, autoStart };
}