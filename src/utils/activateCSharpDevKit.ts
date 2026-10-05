/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpDevKitExports } from '../csharpDevKitExports';

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function activateCSharpDevKit(extension: vscode.Extension<CSharpDevKitExports>): Promise<CSharpDevKitExports> {
    return Promise.resolve(extension.activate());
}
