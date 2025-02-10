/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocumentSelector } from 'vscode-languageserver-protocol/lib/common/protocol';

export function combineDocumentSelectors(
    ...selectors: (DocumentSelector | vscode.DocumentSelector)[]
): vscode.DocumentSelector {
    return selectors.reduce<(string | vscode.DocumentFilter)[]>((acc, selector) => acc.concat(<any>selector), []);
}
