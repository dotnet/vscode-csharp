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
    private previousVersion = -1;

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

    public async setContent(checksum: string, content: string) {
        const document = await vscode.workspace.openTextDocument(this.uri);
        // Capture the version _before_ the change, so we can know for sure if it's been seen
        this.previousVersion = document.version;
        this.checksum = checksum;
        this.content = content;
    }

    public async waitForBufferUpdate() {
        const document = await vscode.workspace.openTextDocument(this.uri);

        // Wait for VS Code to process any previous content change. We don't care about finding
        // a specific version, just that it's moved on from the previous one.
        while (document.version === this.previousVersion) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }
}
