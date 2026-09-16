/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { major } from 'semver';
import { CSharpDevKitExports } from './csharpDevKitExports';
import { csharpDevkitExtensionId } from './utils/getCSharpDevKit';

const requiredCSharpDevKitMajorVersion = 11;

export async function checkCSharpDevKitVersion(
    csharpDevKitExtension: vscode.Extension<CSharpDevKitExports> | undefined
): Promise<void> {
    if (
        !csharpDevKitExtension ||
        major(csharpDevKitExtension.packageJSON.version) >= requiredCSharpDevKitMajorVersion
    ) {
        return;
    }

    const message = vscode.l10n.t(
        'C# Dev Kit version 11 or later is required. Please switch to the pre-release version of the C# Dev Kit.'
    );
    const openCSharpDevKit = vscode.l10n.t('Open C# Dev Kit');
    const selection = await vscode.window.showErrorMessage(message, { modal: true }, openCSharpDevKit);
    if (selection === openCSharpDevKit) {
        await vscode.commands.executeCommand('extension.open', csharpDevkitExtensionId);
    }
    throw new Error(message);
}
