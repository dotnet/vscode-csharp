/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CSharpProjectedDocument } from '../csharp/csharpProjectedDocument';
import { HtmlProjectedDocument } from '../html/htmlProjectedDocument';
import { getUriPath } from '../uriPaths';
import { IRazorDocument } from './IRazorDocument';

export class RazorDocument implements IRazorDocument {
    public readonly path: string;

    constructor(
        readonly uri: vscode.Uri,
        readonly csharpDocument: CSharpProjectedDocument,
        readonly htmlDocument: HtmlProjectedDocument
    ) {
        this.path = getUriPath(uri);
    }

    public get isOpen(): boolean {
        for (const textDocument of vscode.workspace.textDocuments) {
            if (textDocument.uri.fsPath == this.uri.fsPath) {
                return true;
            }
        }

        return false;
    }
}
