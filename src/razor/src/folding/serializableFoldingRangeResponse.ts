/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FoldingRange } from 'vscode-languageserver-protocol';

export class SerializableFoldingRangeResponse {
    constructor(public htmlRanges: FoldingRange[], public csharpRanges: FoldingRange[]) {}
}
