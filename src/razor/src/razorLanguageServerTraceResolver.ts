/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Trace } from './trace';
import * as vscode from './vscodeAdapter';
import * as l10n from '@vscode/l10n';

export function resolveRazorLanguageServerTrace(vscodeApi: vscode.api) {
    const languageConfig = vscodeApi.workspace.getConfiguration('razor');
    const traceString = languageConfig.get<string>('trace');
    const trace = parseTraceString(traceString);

    return trace;
}

function parseTraceString(traceString: string | undefined) {
    switch (traceString) {
        case 'Off':
            return Trace.Off;
        case 'Messages':
            return Trace.Messages;
        case 'Verbose':
            return Trace.Verbose;
        default:
            console.log(l10n.t("Invalid trace setting for Razor language server. Defaulting to '{0}'", 'Off'));
            return Trace.Off;
    }
}
