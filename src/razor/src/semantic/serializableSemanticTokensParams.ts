/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SerializableRange } from '../rpc/serializableRange';
import { SerializableTextDocumentIdentifier } from '../rpc/serializableTextDocumentIdentifier';

export interface SerializableSemanticTokensParams {
    textDocument: SerializableTextDocumentIdentifier;
    range: SerializableRange;
}
