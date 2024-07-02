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
    const forceRuntimeCodeGeneration = serverConfig.get<boolean>('forceRuntimeCodeGeneration');

    return {
        serverPath: languageServerExecutablePath,
        debug: debugLanguageServer,
        logLevel: logLevel,
        outputChannel: logger.outputChannel,
        usingOmniSharp,
        forceRuntimeCodeGeneration,
    } as RazorLanguageServerOptions;
}

function findLanguageServerExecutable(withinDir: string) {
    // On Windows we use the executable, which is "rzls.exe".
    // On macOS we use the dll, which is "rzls.dll".
    // On everything else we use the executable, which is "rzls".

    const fileName = 'rzls';
    let extension = '';

    if (isWindows()) {
        extension = '.exe';
    }

    if (isMacOS()) {
        // Use the DLL on MacOS to work around signing issue tracked by https://devdiv.visualstudio.com/DevDiv/_workitems/edit/1767519/
        extension = '.dll';
    }

    let pathWithExtension = `${fileName}${extension}`;
    if (!fs.existsSync(pathWithExtension)) {
        // We might be running a platform neutral vsix which has no executable, instead we run the dll directly.
        pathWithExtension = `${fileName}.dll`;
    }

    const fullPath = path.join(withinDir, pathWithExtension);

    if (!fs.existsSync(fullPath)) {
        throw new Error(
            vscode.l10n.t("Could not find Razor Language Server executable '{0}' within directory", fullPath)
        );
    }

    return fullPath;
}

function isWindows() {
    return !!os.platform().match(/^win/);
}

function isMacOS() {
    return os.platform() === 'darwin';
}
