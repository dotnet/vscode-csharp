/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpDevKitExports } from '../csharpDevKitExports';
import { languageServerOptions } from '../shared/options';

export const csharpDevkitExtensionId = 'ms-dotnettools.csdevkit';
export const csharpDevkitIntelliCodeExtensionId = 'ms-dotnettools.vscodeintellicode-csharp';

export function getCSharpDevKit(): vscode.Extension<CSharpDevKitExports> | undefined {
    // Devkit is explicitly disabled via the option - we should ignore it even if it exists.
    if (languageServerOptions.preferCSharpExtension) {
        return undefined;
    }

    return vscode.extensions.getExtension<CSharpDevKitExports>(csharpDevkitExtensionId);
}
