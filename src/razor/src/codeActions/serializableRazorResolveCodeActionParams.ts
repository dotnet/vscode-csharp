/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { LanguageKind } from '../rpc/languageKind';
import { CodeAction } from 'vscode-languageserver-protocol';
import { SerializableTextDocumentIdentifier } from '../rpc/serializableTextDocumentIdentifier';

export interface SerializableRazorResolveCodeActionParams {
    hostDocumentVersion: number;
    identifier: SerializableTextDocumentIdentifier;
    languageKind: LanguageKind;
    codeAction: CodeAction;
}
