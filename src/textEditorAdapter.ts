/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscodeAdapter from './vscodeAdapter';
import * as vscode from 'vscode';

export class TextEditorAdapter implements vscodeAdapter.TextEditor {

    get document(): any {
        return this.textEditor.document;
    }

    constructor(private textEditor: vscode.TextEditor) {
    }
}