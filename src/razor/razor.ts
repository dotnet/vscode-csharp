/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as Razor from 'microsoft.aspnetcore.razor.vscode';
import { EventStream } from '../EventStream';

export async function activateRazorExtension(context: vscode.ExtensionContext, extensionPath: string, eventStream: EventStream) {
    const razorConfig = vscode.workspace.getConfiguration('razor');
    const configuredLanguageServerDir = razorConfig.get<string>('languageServer.directory', null);
    const languageServerDir = configuredLanguageServerDir || path.join(extensionPath, '.razor');

    if (fs.existsSync(languageServerDir)) {
        await Razor.activate(vscode, context, languageServerDir, eventStream, /* enableProposedApis: */ false);
    } else if (configuredLanguageServerDir) {
        // It's only an error if the nonexistent dir was explicitly configured
        // If it's the default dir, this is expected for unsupported platforms
        vscode.window.showErrorMessage(
            `Cannot load Razor language server because the configured directory was not found: '${languageServerDir}'`);
    }
}
