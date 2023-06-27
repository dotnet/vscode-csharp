/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as Razor from '../../src/razor/src/extension';
import { EventStream } from '../eventStream';

export async function activateRazorExtension(
    context: vscode.ExtensionContext,
    extensionPath: string,
    eventStream: EventStream
) {
    const razorConfig = vscode.workspace.getConfiguration('razor');
    const configuredLanguageServerDir = razorConfig.get<string>('languageServer.directory', '');
    const languageServerDir =
        configuredLanguageServerDir.length > 0 ? configuredLanguageServerDir : path.join(extensionPath, '.razor');

    if (fs.existsSync(languageServerDir)) {
        await Razor.activate(vscode, context, languageServerDir, eventStream, /* enableProposedApis: */ false);
    } else {
        vscode.window.showWarningMessage(
            `Cannot load Razor language server because the directory was not found: '${languageServerDir}'`
        );
    }
}
