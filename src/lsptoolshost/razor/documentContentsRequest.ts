/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocumentIdentifier } from 'vscode-languageserver-types';
import { GeneratedDocumentKind } from './generatedDocumentKind';

export class DocumentContentsRequest {
    constructor(public readonly textDocument: TextDocumentIdentifier, public readonly kind: GeneratedDocumentKind) {}
}
