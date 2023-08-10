/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SerializableTextDocumentIdentifierAndVersion } from './serializableTextDocumentIdentifierAndVersion';
import { TextEdit } from 'vscode-html-languageservice';

export interface SerializableDelegatedSimplifyMethodParams {
    identifier: SerializableTextDocumentIdentifierAndVersion;
    requiresVirtualDocument: boolean;
    textEdit: TextEdit;
}
