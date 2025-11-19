/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export interface RazorLanguageServerOptions {
    serverPath: string;
    outputChannel?: vscode.LogOutputChannel;
    debug?: boolean;
    usingOmniSharp: boolean;
    suppressErrorToasts: boolean;
}
