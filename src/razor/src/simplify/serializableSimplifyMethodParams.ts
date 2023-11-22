/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextEdit } from 'vscode-html-languageservice';
import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';

export default class SerializableSimplifyMethodParams {
    constructor(public readonly textDocument: TextDocumentIdentifier, public readonly textEdit: TextEdit) {}
}
