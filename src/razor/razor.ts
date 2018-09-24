/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as Razor from 'microsoft.aspnetcore.razor.vscode';

export async function activateRazorExtension(context: vscode.ExtensionContext) {
    const razorConfig = vscode.workspace.getConfiguration('razor');
    const configuredLanguageServerPath = razorConfig.get<string>('languageServer.path', null);
    const languageServerPath = configuredLanguageServerPath || path.join(context.extensionPath, '.razor');

    if (fs.existsSync(languageServerPath)) {
        await Razor.activate(context, languageServerPath);
    } else if (configuredLanguageServerPath) {
        // It's only an error if the nonexistent path was explicitly configured
        // If it's the default path, this is expected for unsupported platforms
        vscode.window.showErrorMessage(
            `Cannot load Razor language server because the configured path was not found: '${languageServerPath}'`);
    }
}
