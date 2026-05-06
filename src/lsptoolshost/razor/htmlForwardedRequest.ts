/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocumentIdentifier } from 'vscode-languageclient';

export class HtmlForwardedRequest<Params> {
    constructor(
        public readonly textDocument: TextDocumentIdentifier,
        public readonly checksum: string,
        public readonly request: Params
    ) {}
}
