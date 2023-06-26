/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { SerializableTextDocumentIdentifier } from '../rpc/serializableTextDocumentIdentifier';

export interface SerializableFormattingParams {
    hostDocumentVersion: number;
    textDocument: SerializableTextDocumentIdentifier;
    options: vscode.FormattingOptions;
}
