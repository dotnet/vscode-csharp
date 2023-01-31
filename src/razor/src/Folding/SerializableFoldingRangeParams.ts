/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { integer } from 'vscode-languageserver-types';
import { SerializableTextDocumentIdentifier } from '../RPC/SerializableTextDocumentIdentifier';

export interface SerializableFoldingRangeParams {
    hostDocumentVersion: integer;
    textDocument: SerializableTextDocumentIdentifier;
}
