/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { razorTextSpan } from '../dynamicFile/razorTextSpan';

export interface RazorMapToDocumentRangesResponse {
    ranges: vscode.Range[];
    hostDocumentVersion: number;
    spans: razorTextSpan[];
}
