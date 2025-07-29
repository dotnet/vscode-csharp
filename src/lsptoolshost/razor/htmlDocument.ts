/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { getUriPath } from '../../razor/src/uriPaths';

export class HtmlDocument {
    public readonly path: string;
    private content = '';
    private checksum = '';

    public constructor(public readonly uri: vscode.Uri, checksum: string) {
        this.path = getUriPath(uri);
        this.checksum = checksum;
    }

    public getContent() {
        return this.content;
    }

    public getChecksum() {
        return this.checksum;
    }

    public setContent(checksum: string, content: string) {
        this.checksum = checksum;
        this.content = content;
    }
}
