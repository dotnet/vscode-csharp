﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IProjectedDocument } from '../projection/IProjectedDocument';
import { ServerTextChange } from '../rpc/serverTextChange';
import { getUriPath } from '../uriPaths';

export class HtmlProjectedDocument implements IProjectedDocument {
    public readonly path: string;
    private content = '';
    private hostDocumentVersion: number | null = null;

    public constructor(public readonly uri: vscode.Uri) {
        this.path = getUriPath(uri);
    }

    public get hostDocumentSyncVersion(): number | null {
        return this.hostDocumentVersion;
    }

    public get length(): number {
        return this.content.length;
    }

    public clear() {
        this.setContent('');
    }

    public update(edits: ServerTextChange[], hostDocumentVersion: number) {
        this.hostDocumentVersion = hostDocumentVersion;

        if (edits.length === 0) {
            return;
        }

        let content = this.content;
        for (const edit of edits.reverse()) {
            // TODO: Use a better data structure to represent the content, string concatenation is slow.
            content = this.getEditedContent(edit.newText, edit.span.start, edit.span.start + edit.span.length, content);
        }

        this.setContent(content);
    }

    public getContent() {
        return this.content;
    }

    private getEditedContent(newText: string, start: number, end: number, content: string) {
        const before = content.substr(0, start);
        const after = content.substr(end);
        content = `${before}${newText}${after}`;

        return content;
    }

    private setContent(content: string) {
        this.content = content;
    }
}
