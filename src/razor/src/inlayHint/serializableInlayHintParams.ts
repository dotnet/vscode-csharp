/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range } from 'vscode-languageserver-protocol';
import { SerializableTextDocumentIdentifierAndVersion } from '../simplify/serializableTextDocumentIdentifierAndVersion';

export interface SerializableInlayHintParams {
    identifier: SerializableTextDocumentIdentifierAndVersion;
    projectedRange: Range;
}
