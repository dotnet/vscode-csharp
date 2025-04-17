/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { razorTextChange } from '../dynamicFile/razorTextChange';
import { LanguageKind } from './languageKind';

export interface RazorMapToDocumentEditsParams {
    kind: LanguageKind;
    razorDocumentUri: vscode.Uri;
    textChanges: razorTextChange[];
}
