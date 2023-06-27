/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { CodeActionContext } from 'vscode-languageserver-protocol';
import { SerializableRange } from '../rpc/serializableRange';
import { SerializableTextDocumentIdentifier } from '../rpc/serializableTextDocumentIdentifier';

export interface SerializableCodeActionParams {
    textDocument: SerializableTextDocumentIdentifier;
    range: SerializableRange;
    context: CodeActionContext;
}
