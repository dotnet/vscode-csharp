/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as RoslynProtocol from './roslynProtocol';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { UriConverter } from './uriConverter';
import * as lsp from 'vscode-languageserver-protocol';
import { IDisposable } from '@microsoft/servicehub-framework';

export function registerSourceGeneratedFilesContentProvider(
    context: vscode.ExtensionContext,
    languageServer: RoslynLanguageServer
) {
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(
            'roslyn-source-generated',
            new RoslynSourceGeneratedContentProvider(languageServer)
        )
    );
}

class RoslynSourceGeneratedContentProvider implements vscode.TextDocumentContentProvider, IDisposable {
    private _onDidChangeEmitter: vscode.EventEmitter<vscode.Uri> = new vscode.EventEmitter<vscode.Uri>();

    // Stores all the source generated documents that we have opened so far and their up to date content.
    private _openedDocuments: Map<vscode.Uri, RoslynProtocol.SourceGeneratedDocumentText> = new Map();

    // Since we could potentially have multiple refresh notifications in flight at the same time,
    // we use a simple queue to ensure that updates to our state map only happen serially.
    private _updateQueue?: Promise<RoslynProtocol.SourceGeneratedDocumentText>;

    private _cancellationSource = new vscode.CancellationTokenSource();

    constructor(private languageServer: RoslynLanguageServer) {
        languageServer.registerOnNotification(
            RoslynProtocol.RefreshSourceGeneratedDocumentNotification.method,
            async () => {
                this._openedDocuments.forEach(async (_, key) => {
                    await this.enqueueDocumentUpdateAsync(key, this._cancellationSource.token);
                    this._onDidChangeEmitter.fire(key);
                });
            }
        );
        vscode.workspace.onDidCloseTextDocument((document) => {
            const openedDoc = this._openedDocuments.get(document.uri);
            if (openedDoc !== undefined) {
                this._openedDocuments.delete(document.uri);
            }
        });
    }

    public onDidChange: vscode.Event<vscode.Uri> = this._onDidChangeEmitter.event;

    async provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): Promise<string> {
        let content = this._openedDocuments.get(uri);

        if (!content) {
            // We're being asked about this document for the first time, so we need to fetch it from the server.
            content = await this.enqueueDocumentUpdateAsync(uri, token);
        }

        return content.text ?? vscode.l10n.t('Generated document not found');
    }

    private async enqueueDocumentUpdateAsync(
        uri: vscode.Uri,
        token: vscode.CancellationToken
    ): Promise<RoslynProtocol.SourceGeneratedDocumentText> {
        if (!this._updateQueue) {
            this._updateQueue = this.updateDocumentAsync(uri, token);
        } else {
            this._updateQueue = this._updateQueue.then(async () => await this.updateDocumentAsync(uri, token));
        }

        return await this._updateQueue;
    }

    private async updateDocumentAsync(
        uri: vscode.Uri,
        token: vscode.CancellationToken
    ): Promise<RoslynProtocol.SourceGeneratedDocumentText> {
        const currentContent = this._openedDocuments.get(uri);
        const newContent = await this.languageServer.sendRequest(
            RoslynProtocol.SourceGeneratorGetTextRequest.type,
            {
                textDocument: lsp.TextDocumentIdentifier.create(UriConverter.serialize(uri)),
                resultId: currentContent?.resultId,
            },
            token
        );

        // If we had no content before, or the resultId has changed, update the content
        if (!currentContent || newContent.resultId !== currentContent?.resultId) {
            this._openedDocuments.set(uri, newContent);
            return newContent;
        }

        return currentContent;
    }

    dispose(): void {
        this._cancellationSource.cancel();
    }
}
