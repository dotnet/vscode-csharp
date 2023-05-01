/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { LanguageKind } from '../RPC/LanguageKind';
import { CodeAction } from 'vscode-languageserver-protocol';

export interface SerializableRazorResolveCodeActionParams {
    hostDocumentVersion: number;
    uri: string;
    languageKind: LanguageKind;
    codeAction: CodeAction;
}
