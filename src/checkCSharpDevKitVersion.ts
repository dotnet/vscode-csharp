/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { major } from 'semver';
import { CSharpDevKitExports } from './csharpDevKitExports';

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
        'This version of the C# extension requires C# Dev Kit version 11 or later. Please install the pre-release version of C# Dev Kit or use the release version of the C# extension.'
    );
    await vscode.window.showErrorMessage(message);
    throw new Error(message);
}
