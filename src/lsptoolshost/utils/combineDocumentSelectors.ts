/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export function combineDocumentSelectors(...selectors: vscode.DocumentSelector[]): vscode.DocumentSelector {
    return selectors.reduce<(string | vscode.DocumentFilter)[]>((acc, selector) => acc.concat(selector), []);
}
