/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { SerializableTextDocumentIdentifier } from '../RPC/SerializableTextDocumentIdentifier';

export interface SerializableDocumentColorParams {
    textDocument: SerializableTextDocumentIdentifier;
}
