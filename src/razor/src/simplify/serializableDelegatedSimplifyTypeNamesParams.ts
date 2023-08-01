/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OptionalVersionedTextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { SerializableTextDocumentIdentifierAndVersion } from './serializableTextDocumentIdentifierAndVersion';

export interface SerializableDelegatedSimplifyTypeNamesParams {
    identifier: SerializableTextDocumentIdentifierAndVersion;
    codeBehindIdentifier: OptionalVersionedTextDocumentIdentifier;
    fullyQualifiedTypeNames: string[];
    absoluteIndex: number;
}
