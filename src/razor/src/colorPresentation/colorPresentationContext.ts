/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Range } from 'vscode-languageserver-protocol';

export class ColorPresentationContext {
    constructor(public readonly uri: vscode.Uri, public readonly range: Range) {}
}
