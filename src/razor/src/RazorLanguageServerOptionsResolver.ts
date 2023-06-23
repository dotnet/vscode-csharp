/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RazorLanguageServerOptions } from './RazorLanguageServerOptions';
import { RazorLogger } from './RazorLogger';
import { Trace } from './Trace';
import * as vscode from './vscodeAdapter';
import { getCSharpDevKit } from '../../utils/getCSharpDevKit';

export function resolveRazorLanguageServerOptions(
    vscodeApi: vscode.api,
    languageServerDir: string,
    trace: Trace,
    logger: RazorLogger) {
    const languageServerExecutablePath = findLanguageServerExecutable(languageServerDir);
    const serverConfig = vscodeApi.workspace.getConfiguration('razor.languageServer');
    const debugLanguageServer = serverConfig.get<boolean>('debug');
    const usingOmniSharp = !getCSharpDevKit()&& vscodeApi.workspace.getConfiguration().get<Boolean>('dotnet.server.useOmnisharp');

    return {
        serverPath: languageServerExecutablePath,
        debug: debugLanguageServer,
        trace,
        outputChannel: logger.outputChannel,
        usingOmniSharp
    } as RazorLanguageServerOptions;
}

function findLanguageServerExecutable(withinDir: string) {
    const isSelfContained = fs.existsSync(path.join(withinDir, 'coreclr.dll'));
    let fullPath = '';
    if (isSelfContained) {
        const fileName = isWindows() ? 'rzls.exe' : 'rzls';
        fullPath = path.join(withinDir, fileName);
    } else {
        fullPath = path.join(withinDir, 'rzls.dll');
    }

    if (!fs.existsSync(fullPath)) {
        throw new Error(`Could not find Razor Language Server executable within directory '${withinDir}'`);
    }

    return fullPath;
}

function isWindows() {
    return !!os.platform().match(/^win/);
}
