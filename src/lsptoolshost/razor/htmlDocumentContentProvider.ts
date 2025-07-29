/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { HtmlDocumentManager } from './htmlDocumentManager';
import { RazorLogger } from '../../razor/src/razorLogger';
import { getUriPath } from '../../razor/src/uriPaths';

export class HtmlDocumentContentProvider implements vscode.TextDocumentContentProvider {
    public static readonly scheme = 'razor-html';

    private readonly onDidChangeEmitter: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();

    constructor(private readonly documentManager: HtmlDocumentManager, private readonly logger: RazorLogger) {}

    public get onDidChange() {
        return this.onDidChangeEmitter.event;
    }

    public fireDidChange(uri: vscode.Uri) {
        this.onDidChangeEmitter.fire(uri);
    }

    public provideTextDocumentContent(uri: vscode.Uri) {
        const document = this.findDocument(uri);
        if (!document) {
            // Document was removed from the document manager, meaning there's no more content for this
            // file. Report an empty document.
            this.logger.logTrace(
                `Could not find document '${getUriPath(
                    uri
                )}' when updating the HTML buffer. This typically happens when a document is removed.`
            );
            return '';
        }

        return document.getContent();
    }

    private findDocument(uri: vscode.Uri) {
        const projectedPath = getUriPath(uri);

        return this.documentManager.documents.find(
            (document) => document.path.localeCompare(projectedPath, undefined, { sensitivity: 'base' }) === 0
        );
    }
}
