/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as RazorOmniSharp from 'microsoft.aspnetcore.razor.vscode';
import * as path from 'path';
import * as vscode from 'vscode';
import { EventStream } from '../eventStream';
import { showWarningMessage } from '../shared/observers/utils/showMessage';

export async function activateRazorOmniSharpExtension(
    context: vscode.ExtensionContext,
    extensionPath: string,
    eventStream: EventStream
) {
    const razorConfig = vscode.workspace.getConfiguration('razor');
    const configuredLanguageServerDir = razorConfig.get<string>('languageServer.directory', '');
    const languageServerDir =
        configuredLanguageServerDir.length > 0
            ? configuredLanguageServerDir
            : path.join(extensionPath, '.razoromnisharp');

    if (fs.existsSync(languageServerDir)) {
        await RazorOmniSharp.activate(vscode, context, languageServerDir, eventStream, /* enableProposedApis: */ false);
    } else {
        showWarningMessage(
            vscode,
            vscode.l10n.t(
                "Cannot load Razor OmniSharp language server because the directory was not found: '{0}'",
                languageServerDir
            )
        );
    }
}
