/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { getUriPath } from '../../razor/src/uriPaths';

export class HtmlDocument {
    public readonly path: string;
    private content = '';

    public constructor(public readonly uri: vscode.Uri) {
        this.path = getUriPath(uri);
    }

    public getContent() {
        return this.content;
    }

    public setContent(content: string) {
        this.content = content;
    }
}
