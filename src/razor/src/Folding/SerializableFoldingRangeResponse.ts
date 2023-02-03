/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';

export class SerializableFoldingRangeResponse {
    constructor(public htmlRanges: vscode.FoldingRange[], public csharpRanges: vscode.FoldingRange[]) {}
}
