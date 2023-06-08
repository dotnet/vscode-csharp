/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpDevKitExports } from "../CSharpDevKitExports";

export const csharpDevkitExtensionId = "ms-dotnettools.csdevkit";

export function getCSharpDevKit(): vscode.Extension<CSharpDevKitExports> | undefined {
    return vscode.extensions.getExtension<CSharpDevKitExports>(csharpDevkitExtensionId);
}