/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import { LanguageKind } from '../RPC/LanguageKind';
import { SerializableRange } from '../RPC/SerializableRange';

export interface RazorDocumentRangeFormattingRequest {
    kind: LanguageKind;
    hostDocumentFilePath: string;
    projectedRange: SerializableRange;
    options: vscode.FormattingOptions;
}
