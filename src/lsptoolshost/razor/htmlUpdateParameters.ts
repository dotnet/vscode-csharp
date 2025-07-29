/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';

export class HtmlUpdateParameters {
    constructor(
        public readonly textDocument: TextDocumentIdentifier,
        public readonly checksum: string,
        public readonly text: string
    ) {}
}
