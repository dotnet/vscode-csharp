/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompletionItem } from 'vscode-languageserver-protocol';
import { LanguageKind } from '../rpc/languageKind';
import { SerializableTextDocumentIdentifierAndVersion } from '../simplify/serializableTextDocumentIdentifierAndVersion';

export interface SerializableDelegatedCompletionItemResolveParams {
    // TODO: test OptionalVersionedTextDocumentIdentifier from vscode-languageclient
    identifier: SerializableTextDocumentIdentifierAndVersion;
    completionItem: CompletionItem;
    originatingKind: LanguageKind;
}
