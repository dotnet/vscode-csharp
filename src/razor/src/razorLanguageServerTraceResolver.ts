/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LogLevel } from './logLevel';
import * as vscodeAdapter from './vscodeAdapter';
import * as vscode from 'vscode';

export function resolveRazorLanguageServerLogLevel(vscodeApi: vscodeAdapter.api) {
    const languageConfig = vscodeApi.workspace.getConfiguration('razor.server');
    const traceString = languageConfig.get<string>('trace');
    const logLevel = parseTraceString(traceString);

    return logLevel;
}

function parseTraceString(traceString: string | undefined) {
    switch (traceString) {
        case 'Trace':
            return LogLevel.Trace;
        case 'Verbose': // For importing old config values
        case 'Debug':
            return LogLevel.Debug;
        case 'Messages': // For importing old config values
        case 'Information':
            return LogLevel.Information;
        case 'Warning':
            return LogLevel.Warning;
        case 'Error':
            return LogLevel.Error;
        case 'Critical':
            return LogLevel.Critical;
        case 'Off': // For importing old config values
        case 'None':
            return LogLevel.None;

        default:
            console.log(vscode.l10n.t("Invalid razor.server.trace setting. Defaulting to '{0}'", 'Information'));
            return LogLevel.Information;
    }
}
