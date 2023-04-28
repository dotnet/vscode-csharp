/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { Uri } from 'vscode';
import { LanguageKind } from '../RPC/LanguageKind';
import { CodeAction } from 'vscode-languageserver-protocol';

export interface SerializableRazorResolveCodeActionParams {
    uri: Uri;
    languageKind: LanguageKind;
    codeAction: CodeAction;
}
