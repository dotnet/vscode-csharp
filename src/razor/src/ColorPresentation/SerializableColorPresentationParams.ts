/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { SerializableRange } from '../RPC/SerializableRange';
import { SerializableTextDocumentIdentifier } from '../RPC/SerializableTextDocumentIdentifier';

export interface SerializableColorPresentationParams {
    textDocument: SerializableTextDocumentIdentifier;
    color: vscode.Color;
    range: SerializableRange;
}
