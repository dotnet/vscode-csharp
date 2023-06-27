/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';
import { SerializablePosition } from '../rpc/serializablePosition';
import { SerializableTextDocumentIdentifier } from '../rpc/serializableTextDocumentIdentifier';

export interface SerializableOnTypeFormattingParams {
    hostDocumentVersion: number;
    textDocument: SerializableTextDocumentIdentifier;
    ch: string;
    position: SerializablePosition;
    options: vscode.FormattingOptions;
}
