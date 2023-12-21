/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscodeAdapter from './vscodeAdapter';
import * as vscode from 'vscode';
import { RazorLanguageServerOptions } from './razorLanguageServerOptions';
import { RazorLogger } from './razorLogger';
import { LogLevel } from './logLevel';
import { getCSharpDevKit } from '../../utils/getCSharpDevKit';

export function resolveRazorLanguageServerOptions(
    vscodeApi: vscodeAdapter.api,
    languageServerDir: string,
    logLevel: LogLevel,
    logger: RazorLogger
) {
    const languageServerExecutablePath = findLanguageServerExecutable(languageServerDir);
    const serverConfig = vscodeApi.workspace.getConfiguration('razor.languageServer');
    const debugLanguageServer = serverConfig.get<boolean>('debug');
    const usingOmniSharp =
        !getCSharpDevKit() && vscodeApi.workspace.getConfiguration().get<boolean>('dotnet.server.useOmnisharp');

    return {
        serverPath: languageServerExecutablePath,
        debug: debugLanguageServer,
        logLevel: logLevel,
        outputChannel: logger.outputChannel,
        usingOmniSharp,
    } as RazorLanguageServerOptions;
}

function findLanguageServerExecutable(withinDir: string) {
    const extension = isWindows() ? '.exe' : '';
    const executablePath = path.join(withinDir, `rzls${extension}`);
    let fullPath = '';

    if (fs.existsSync(executablePath)) {
        fullPath = executablePath;
    } else {
        // Exe doesn't exist.
        const dllPath = path.join(withinDir, 'rzls.dll');

        if (!fs.existsSync(dllPath)) {
            throw new Error(
                vscode.l10n.t("Could not find Razor Language Server executable within directory '{0}'", withinDir)
            );
        }

        fullPath = dllPath;
    }

    return fullPath;
}

function isWindows() {
    return !!os.platform().match(/^win/);
}
