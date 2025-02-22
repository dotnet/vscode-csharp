/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompletionContext } from 'vscode-languageserver-protocol';
import { LanguageKind } from '../rpc/languageKind';
import { SerializablePosition } from '../rpc/serializablePosition';
import { SerializableTextDocumentIdentifierAndVersion } from '../simplify/serializableTextDocumentIdentifierAndVersion';
import { SerializableTextEdit } from '../rpc/serializableTextEdit';

// TODO: cleanup parameter types
export interface SerializableDelegatedCompletionParams {
    identifier: SerializableTextDocumentIdentifierAndVersion;
    projectedPosition: SerializablePosition;
    projectedKind: LanguageKind;
    context: CompletionContext;
    provisionalTextEdit?: SerializableTextEdit;
    shouldIncludeSnippets: boolean;
    // Do I need correlation ID?
}
