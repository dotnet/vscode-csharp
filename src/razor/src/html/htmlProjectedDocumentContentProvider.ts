﻿/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IRazorDocumentChangeEvent } from '../document/IRazorDocumentChangeEvent';
import { IRazorDocumentManager } from '../document/IRazorDocumentManager';
import { RazorDocumentChangeKind } from '../document/razorDocumentChangeKind';
import { IEventEmitterFactory } from '../IEventEmitterFactory';
import { RazorLogger } from '../razorLogger';
import { getUriPath } from '../uriPaths';
import * as vscode from '../vscodeAdapter';

export class HtmlProjectedDocumentContentProvider implements vscode.TextDocumentContentProvider {
    public static readonly scheme = 'razor-html';

    private readonly onDidChangeEmitter: vscode.EventEmitter<vscode.Uri>;

    constructor(
        private readonly documentManager: IRazorDocumentManager,
        eventEmitterFactory: IEventEmitterFactory,
        private readonly logger: RazorLogger
    ) {
        documentManager.onChange((event: IRazorDocumentChangeEvent) => this.documentChanged(event));
        this.onDidChangeEmitter = eventEmitterFactory.create<vscode.Uri>();
    }

    public get onDidChange() {
        return this.onDidChangeEmitter.event;
    }

    public provideTextDocumentContent(uri: vscode.Uri) {
        const razorDocument = this.findRazorDocument(uri);
        if (!razorDocument) {
            // Document was removed from the document manager, meaning there's no more content for this
            // file. Report an empty document.

            if (this.logger.verboseEnabled) {
                this.logger.logVerbose(
                    `Could not find document '${getUriPath(
                        uri
                    )}' when updating the HTML buffer. This typically happens when a document is removed.`
                );
            }
            return '';
        }

        const content = `${razorDocument.htmlDocument.getContent()}
// ${razorDocument.htmlDocument.hostDocumentSyncVersion}`;

        return content;
    }

    private documentChanged(event: IRazorDocumentChangeEvent) {
        if (
            event.kind === RazorDocumentChangeKind.htmlChanged ||
            event.kind === RazorDocumentChangeKind.opened ||
            event.kind === RazorDocumentChangeKind.removed
        ) {
            // We also notify changes on document removal in order to tell VSCode that there's no more
            // HTML content for the file.

            this.onDidChangeEmitter.fire(event.document.htmlDocument.uri);
        }
    }

    private findRazorDocument(uri: vscode.Uri) {
        const projectedPath = getUriPath(uri);

        return this.documentManager.documents.find(
            (razorDocument) =>
                razorDocument.htmlDocument.path.localeCompare(projectedPath, undefined, { sensitivity: 'base' }) === 0
        );
    }
}
