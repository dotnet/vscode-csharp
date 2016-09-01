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

    const path = csharpConfig.has('omnisharp')
        ? csharpConfig.get<string>('omnisharp')
        : omnisharpConfig.get<string>('path');

    const useMono = csharpConfig.has('omnisharpUsesMono')
        ? csharpConfig.get<boolean>('omnisharpUsesMono')
        : omnisharpConfig.get<boolean>('useMono');

    const loggingLevel = omnisharpConfig.get<string>('loggingLevel');
    const autoStart = omnisharpConfig.get<boolean>('autoStart', true);

    return { path, useMono, loggingLevel, autoStart };
}