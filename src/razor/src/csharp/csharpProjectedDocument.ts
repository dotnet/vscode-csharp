/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProjectedDocument } from '../projection/IProjectedDocument';
import { ServerTextChange } from '../rpc/serverTextChange';
import { getUriPath } from '../uriPaths';
import * as vscode from '../vscodeAdapter';

export class CSharpProjectedDocument implements IProjectedDocument {
    public readonly path: string;

    private content = '';
    private preProvisionalContent: string | undefined;
    private preResolveProvisionalContent: string | undefined;
    private provisionalEditAt: number | undefined;
    private resolveProvisionalEditAt: number | undefined;
    private hostDocumentVersion: number | null = null;
    private projectedDocumentVersion = 0;

    public constructor(public readonly uri: vscode.Uri) {
        this.path = getUriPath(uri);
    }

    public get hostDocumentSyncVersion(): number | null {
        return this.hostDocumentVersion;
    }

    public get projectedDocumentSyncVersion(): number {
        return this.projectedDocumentVersion;
    }

    public get length(): number {
        return this.content.length;
    }

    public clear() {
        this.setContent('');
    }

    public update(edits: ServerTextChange[], hostDocumentVersion: number) {
        this.removeProvisionalDot();

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

    // A provisional dot represents a '.' that's inserted into the projected document but will be
    // removed prior to any edits that get applied. In Razor's case a provisional dot is used to
    // show completions after an expression for a dot that's usually interpreted as Html.
    public addProvisionalDotAt(index: number) {
        if (this.provisionalEditAt === index) {
            // Edits already applied.
            return;
        }

        this.removeProvisionalDot();

        const newContent = this.getEditedContent('.', index, index, this.content);
        this.preProvisionalContent = this.content;
        this.provisionalEditAt = index;
        this.setContent(newContent);
    }

    public removeProvisionalDot() {
        if (this.provisionalEditAt && this.preProvisionalContent) {
            // Undo provisional edit if one was applied.
            this.setContent(this.preProvisionalContent);
            this.resolveProvisionalEditAt = this.provisionalEditAt;
            this.provisionalEditAt = undefined;
            this.preProvisionalContent = undefined;
            return true;
        }

        return false;
    }

    public addResolveProvisionalDotAt() {
        //remove the last resolve provisional dot it it exists
        this.removeResolveProvisionalDot();
        if (this.resolveProvisionalEditAt) {
            const newContent = this.getEditedContent(
                '.',
                this.resolveProvisionalEditAt,
                this.resolveProvisionalEditAt,
                this.content
            );
            this.preResolveProvisionalContent = this.content;
            this.setContent(newContent);
            return true;
        }
        return false;
    }

    public removeResolveProvisionalDot(clearEditIndex = false) {
        if (this.resolveProvisionalEditAt && this.preResolveProvisionalContent) {
            if (clearEditIndex) {
                this.resolveProvisionalEditAt = undefined;
            }
            // Undo provisional edit if one was applied.
            this.setContent(this.preResolveProvisionalContent);
            this.provisionalEditAt = undefined;
            this.preResolveProvisionalContent = undefined;
            return true;
        }

        return false;
    }

    public getResolveProvisionalEditIndex() {
        return this.resolveProvisionalEditAt;
    }

    private getEditedContent(newText: string, start: number, end: number, content: string) {
        const before = content.substr(0, start);
        const after = content.substr(end);
        content = `${before}${newText}${after}`;

        return content;
    }

    private setContent(content: string) {
        this.projectedDocumentVersion++;
        this.content = content;
    }
}
