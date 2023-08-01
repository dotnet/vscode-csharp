/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OptionalVersionedTextDocumentIdentifier, TextDocumentIdentifier } from 'vscode-languageserver-protocol';

export default class SerializableSimplifyTypeNamesParams {
    constructor(
        public readonly textDocument: TextDocumentIdentifier,
        public readonly placementTextDocument: OptionalVersionedTextDocumentIdentifier,
        public readonly fullyQualifiedTypeNames: string[],
        public readonly absoluteIndex: number
    ) {}
}
