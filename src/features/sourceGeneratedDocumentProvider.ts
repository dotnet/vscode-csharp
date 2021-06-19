/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as serverUtils from '../omnisharp/utils';
import { Event, EventEmitter, TextDocument, TextDocumentContentProvider, TextEditor, Uri, window, workspace } from 'vscode';
import { IDisposable } from '../Disposable';
import { SourceGeneratedFileInfo, SourceGeneratedFileResponse, UpdateType } from '../omnisharp/protocol';
import { OmniSharpServer } from '../omnisharp/server';

export default class SourceGeneratedDocumentProvider implements TextDocumentContentProvider, IDisposable {
    readonly scheme = "omnisharp-source-generated";
    private _registration: IDisposable;
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
        if (this._uriToDocumentInfo.has(uriString)) {
            const info = this._uriToDocumentInfo.get(uriString);
            this._documents.delete(info);
            this._uriToDocumentInfo.delete(uriString);
            await serverUtils.sourceGeneratedFileClosed(this.server, info);
        }
    }

    private async onVisibleTextEditorsChanged(editors?: TextEditor[]) {
        for (const editor of editors) {
            const documentUri = editor.document.uri;
            const uriString = documentUri.toString();
            if (this._uriToDocumentInfo.has(uriString)) {
                try {
                    const existingInfo = this._uriToDocumentInfo.get(uriString);
                    const existingResponse = this._documents.get(existingInfo);
                    const update = await serverUtils.getUpdatedSourceGeneratedFile(this.server, existingInfo);
                    if (!update) {
                        continue;
                    }

                    switch (update.UpdateType) {
                        case UpdateType.Deleted:
                            this._documents.set(existingInfo, { Source: "Document is no longer being generated.", SourceName: existingResponse.SourceName });
                            break;
                        case UpdateType.Modified:
                            this._documents.set(existingInfo, { Source: update.Source, SourceName: existingResponse.SourceName });
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
        this._registration.dispose();
        this._documentClosedSubscription.dispose();
        this._visibleTextEditorsChangedSubscription.dispose();
        this._documents.clear();
    }

    public tryGetExistingSourceGeneratedFile(fileInfo: SourceGeneratedFileInfo): Uri | undefined {
        if (this._documents.has(fileInfo)) {
            return this.getUriForName(this._documents.get(fileInfo).SourceName);
        }

        return undefined;
    }

    public addSourceGeneratedFile(fileInfo: SourceGeneratedFileInfo, response: SourceGeneratedFileResponse): Uri {
        if (this._documents.has(fileInfo)) {
            // Raced with something, return the existing one
            return this.tryGetExistingSourceGeneratedFile(fileInfo);
        }

        const uri = this.getUriForName(response.SourceName);
        const uriString = uri.toString();

        let triggerUpdate = false;

        if (this._uriToDocumentInfo.has(uriString)) {
            // Old version of the file in the cache. Remove it, and after it's replaced trigger vscode to update the file.
            this._documents.delete(fileInfo);
            this._uriToDocumentInfo.delete(uriString);
            triggerUpdate = true;
        }

        this._documents.set(fileInfo, response);
        this._uriToDocumentInfo.set(uriString, fileInfo);

        if (triggerUpdate) {
            this._onDidChangeEmitter.fire(uri);
        }

        return uri;
    }

    public provideTextDocumentContent(uri: Uri): string {
        return this._documents.get(this._uriToDocumentInfo.get(uri.toString())).Source;
    }

    private getUriForName(sourceName: string): Uri {
        return Uri.parse(this.scheme + ":///" + sourceName);
    }
}
