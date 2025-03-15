/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { lt } from 'semver';

export const DotNetRuntimeExtensionId = 'ms-dotnettools.vscode-dotnet-runtime';
const requiredDotNetRuntimeExtensionVersion = '2.2.3';

export async function checkDotNetRuntimeExtensionVersion(context: vscode.ExtensionContext): Promise<void> {
    const dotnetRuntimeExtension = vscode.extensions.getExtension(DotNetRuntimeExtensionId);
    const dotnetRuntimeExtensionVersion = dotnetRuntimeExtension?.packageJSON.version;
    if (lt(dotnetRuntimeExtensionVersion, requiredDotNetRuntimeExtensionVersion)) {
        const button = vscode.l10n.t('Update and reload');
        const prompt = vscode.l10n.t(
            'The {0} extension requires at least {1} of the .NET Install Tool ({2}) extension. Please update to continue',
            context.extension.packageJSON.displayName,
            requiredDotNetRuntimeExtensionVersion,
            DotNetRuntimeExtensionId
        );
        const selection = await vscode.window.showErrorMessage(prompt, button);
        if (selection === button) {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', DotNetRuntimeExtensionId);
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else {
            throw new Error(
                vscode.l10n.t(
                    'Version {0} of the .NET Install Tool ({1}) was not found, {2} will not activate.',
                    requiredDotNetRuntimeExtensionVersion,
                    DotNetRuntimeExtensionId,
                    context.extension.packageJSON.displayName
                )
            );
        }
    }
}
