/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as RazorOmniSharp from 'microsoft.aspnetcore.razor.vscode';
import * as path from 'path';
import * as vscode from 'vscode';
import * as Razor from '../../src/razor/src/extension';
import { EventStream } from '../eventStream';
import TelemetryReporter from '@vscode/extension-telemetry';

export async function activateRazorExtension(
    context: vscode.ExtensionContext,
    extensionPath: string,
    eventStream: EventStream,
    vscodeTelemetryReporter: TelemetryReporter,
    isCSharpDevKitInstalled: boolean,
    useOmnisharpServer: boolean
) {
    const razorConfig = vscode.workspace.getConfiguration('razor');
    const configuredLanguageServerDir = razorConfig.get<string>('languageServer.directory', '');
    const languageServerDir =
        configuredLanguageServerDir.length > 0
            ? configuredLanguageServerDir
            : useOmnisharpServer
            ? path.join(extensionPath, '.razoromnisharp')
            : path.join(extensionPath, '.razor');

    if (fs.existsSync(languageServerDir)) {
        if (useOmnisharpServer) {
            await RazorOmniSharp.activate(
                vscode,
                context,
                languageServerDir,
                eventStream,
                /* enableProposedApis: */ false
            );
        } else {
            await Razor.activate(
                vscode,
                context,
                languageServerDir,
                eventStream,
                vscodeTelemetryReporter,
                isCSharpDevKitInstalled,
                /* enableProposedApis: */ false
            );
        }
    } else {
        vscode.window.showWarningMessage(
            vscode.l10n.t(
                "Cannot load Razor language server because the directory was not found: '{0}'",
                languageServerDir
            )
        );
    }
}
