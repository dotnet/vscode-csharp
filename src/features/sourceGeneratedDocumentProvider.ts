/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as serverUtils from '../omnisharp/utils';
import { CancellationToken, Event, EventEmitter, TextDocument, TextDocumentContentProvider, TextEditor, Uri, window, workspace } from 'vscode';
import { IDisposable } from '../disposable';
import { SourceGeneratedFileInfo, SourceGeneratedFileResponse, UpdateType } from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';

export default class SourceGeneratedDocumentProvider implements TextDocumentContentProvider, IDisposable {
    readonly scheme = "omnisharp-source-generated";
    private _registration?: IDisposable;
    private _documents: Map<SourceGeneratedFileInfo, SourceGeneratedFileResponse>;
    private _uriToDocumentInfo: Map<string, SourceGeneratedFileInfo>;
    private _documentClosedSubscription: IDisposable;
    private _visibleTextEditorsChangedSubscription: IDisposable;
    private _onDidChangeEmitter: EventEmitter<Uri>;
    public onDidChange: Event<Uri>;

    constructor(private server: OmniSharpServer) {
        this._documents = new Map<SourceGeneratedFileInfo, SourceGeneratedFileResponse>();
        this._uriToDocumentInfo = new Map<string, SourceGeneratedFileInfo>();
        this._documentClosedSubscription = workspace.onDidCloseTextDocument(this.onTextDocumentClosed, this);
        this._visibleTextEditorsChangedSubscription = window.onDidChangeVisibleTextEditors(this.onVisibleTextEditorsChanged, this);
        this._onDidChangeEmitter = new EventEmitter<Uri>();
        this.onDidChange = this._onDidChangeEmitter.event;
    }

    private async onTextDocumentClosed(document: TextDocument) {
        const uriString = document.uri.toString();
        const info = this._uriToDocumentInfo.get(uriString);
        if (info !== undefined) {
            this._documents.delete(info);
            this._uriToDocumentInfo.delete(uriString);
            await serverUtils.sourceGeneratedFileClosed(this.server, info);
        }
    }

    private async onVisibleTextEditorsChanged(editors: readonly TextEditor[]) {
        for (const editor of editors) {
            const documentUri = editor.document.uri;
            const uriString = documentUri.toString();
            const existingInfo = this._uriToDocumentInfo.get(uriString);
            if (existingInfo !== undefined) {
                try {
                    const existingResponse = this._documents.get(existingInfo);
                    if (existingResponse === undefined) {
                        continue;
                    }

                    const update = await serverUtils.getUpdatedSourceGeneratedFile(this.server, existingInfo);
                    switch (update.UpdateType) {
                        case UpdateType.Deleted:
                            existingResponse.Source = "Document is no longer being generated.";
                            break;
                        case UpdateType.Modified:
                            existingResponse.Source = update.Source;
                            break;
                        case UpdateType.Unchanged:
                            continue;
                    }

                    this._onDidChangeEmitter.fire(documentUri);
                } catch {
                    continue;
                }
            }
        }
    }

    public register(): void {
        this._registration = workspace.registerTextDocumentContentProvider(this.scheme, this);
    }

    public dispose() {
        this._registration?.dispose();
        this._documentClosedSubscription.dispose();
        this._visibleTextEditorsChangedSubscription.dispose();
        this._documents.clear();
    }

    public addSourceGeneratedFileWithoutInitialContent(fileInfo: SourceGeneratedFileInfo, fileName: string): Uri {
        const response = this._documents.get(fileInfo);
        if (response !== undefined) {
            // Raced with something, return the existing one.
            return this.getUriForName(response.SourceName);
        }

        const uri = this.getUriForName(fileName);
        const uriString = uri.toString();

        // Provide will see that the document doesn't exist and retrieve the file when asked.
        this._documents.delete(fileInfo);
        this._uriToDocumentInfo.set(uriString, fileInfo);

        return uri;
    }

    public async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string | undefined> {
        const fileInfo = this._uriToDocumentInfo.get(uri.toString());
        if (fileInfo === undefined) {
            return undefined;
        }

        let response = this._documents.get(fileInfo);
        if (response === undefined) {
            // No content yet, get it
            response = await serverUtils.getSourceGeneratedFile(this.server, fileInfo, token);
            this._documents.set(fileInfo, response);
        }

        return response.Source;
    }

    private getUriForName(sourceName: string): Uri {
        return Uri.parse(this.scheme + ":///" + sourceName);
    }
}
