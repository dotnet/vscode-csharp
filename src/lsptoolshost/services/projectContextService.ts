/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../roslynLanguageServer';
import { VSGetProjectContextsRequest, VSProjectContext, VSProjectContextList } from '../roslynProtocol';
import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { UriConverter } from '../uriConverter';
import { LanguageServerEvents } from '../languageServerEvents';
import { ServerState } from '../serverStateChange';

export interface ProjectContextChangeEvent {
    uri: vscode.Uri;
    context: VSProjectContext;
    hasAdditionalContexts: boolean;
}

export class ProjectContextService {
    /** Track the project context for a particular document uri. */
    private readonly _documentContexts: { [uri: string]: VSProjectContext } = {};
    private readonly _contextChangeEmitter = new vscode.EventEmitter<ProjectContextChangeEvent>();
    private _source = new vscode.CancellationTokenSource();

    constructor(private _languageServer: RoslynLanguageServer, _languageServerEvents: LanguageServerEvents) {
        _languageServerEvents.onServerStateChange((e) => {
            // When the project initialization is complete, open files
            // could move from the miscellaneous workspace context into
            // an open project.
            if (e.state === ServerState.ProjectInitializationComplete) {
                this.refresh();
            }
        });

        vscode.window.onDidChangeActiveTextEditor(async (_) => this.refresh());
    }

    public get onDocumentContextChanged(): vscode.Event<ProjectContextChangeEvent> {
        return this._contextChangeEmitter.event;
    }

    public getDocumentContext(uri: string | vscode.Uri): VSProjectContext | undefined {
        const uriString = uri instanceof vscode.Uri ? UriConverter.serialize(uri) : uri;
        return this._documentContexts[uriString];
    }

    public setDocumentContext(
        uri: string | vscode.Uri,
        context: VSProjectContext,
        hasAdditionalContexts: boolean
    ): void {
        const uriString = uri instanceof vscode.Uri ? UriConverter.serialize(uri) : uri;
        uri = uri instanceof vscode.Uri ? uri : UriConverter.deserialize(uri);

        this._documentContexts[uriString] = context;
        this._contextChangeEmitter.fire({ uri, context, hasAdditionalContexts });
    }

    public async refresh() {
        const textEditor = vscode.window.activeTextEditor;
        if (textEditor?.document?.languageId !== 'csharp') {
            return;
        }

        const uri = textEditor.document.uri;

        // If we have an open request, cancel it.
        this._source.cancel();
        this._source = new vscode.CancellationTokenSource();

        const contextList = await this.getProjectContexts(uri, this._source.token);
        if (!contextList) {
            return;
        }

        // Determine if the user has selected a context for this document and whether
        // it is still in the list of contexts.
        const uriString = UriConverter.serialize(uri);
        const selectedContext = this._documentContexts[uriString];
        const selectedContextValid = selectedContext
            ? contextList._vs_projectContexts.some((c) => c._vs_id == selectedContext._vs_id)
            : false;

        const defaultContext = contextList._vs_projectContexts[contextList._vs_defaultIndex];
        const context = selectedContextValid ? selectedContext : defaultContext;
        const hasAdditionalContexts = contextList._vs_projectContexts.length > 1;

        this._contextChangeEmitter.fire({ uri, context, hasAdditionalContexts });
    }

    public async getProjectContexts(
        uri: string | vscode.Uri,
        token: vscode.CancellationToken
    ): Promise<VSProjectContextList | undefined> {
        const uriString = uri instanceof vscode.Uri ? UriConverter.serialize(uri) : uri;
        const textDocument = TextDocumentIdentifier.create(uriString);

        try {
            return this._languageServer.sendRequest(
                VSGetProjectContextsRequest.type,
                { _vs_textDocument: textDocument },
                token
            );
        } catch (error) {
            if (error instanceof vscode.CancellationError) {
                return undefined;
            }

            throw error;
        }
    }
}
