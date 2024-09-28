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
import { DynamicFileInfoHandler } from '../../razor/src/dynamicFile/dynamicFileInfoHandler';
import { ProvideDynamicFileResponse } from '../../razor/src/dynamicFile/provideDynamicFileResponse';
import { ProvideDynamicFileParams } from '../../razor/src/dynamicFile/provideDynamicFileParams';

export interface ProjectContextChangeEvent {
    uri: vscode.Uri;
    context: VSProjectContext;
}

export class ProjectContextService {
    private readonly _contextChangeEmitter = new vscode.EventEmitter<ProjectContextChangeEvent>();
    private _source = new vscode.CancellationTokenSource();
    private readonly _emptyProjectContext: VSProjectContext = {
        _vs_id: '',
        _vs_kind: '',
        _vs_label: '',
    };

    constructor(private _languageServer: RoslynLanguageServer, _languageServerEvents: LanguageServerEvents) {
        _languageServerEvents.onServerStateChange(async (e) => {
            // When the project initialization is complete, open files
            // could move from the miscellaneous workspace context into
            // an open project.
            if (e.state === ServerState.Stopped || e.state === ServerState.ProjectInitializationComplete) {
                await this.refresh();
            }
        });

        vscode.window.onDidChangeActiveTextEditor(async (_) => this.refresh());
    }

    public get onActiveFileContextChanged(): vscode.Event<ProjectContextChangeEvent> {
        return this._contextChangeEmitter.event;
    }

    public async refresh() {
        const textEditor = vscode.window.activeTextEditor;
        const languageId = textEditor?.document?.languageId;
        if (languageId !== 'csharp' && languageId !== 'aspnetcorerazor') {
            return;
        }

        // If we have an open request, cancel it.
        this._source.cancel();
        this._source = new vscode.CancellationTokenSource();

        let uri = textEditor!.document.uri;

        if (!this._languageServer.isRunning()) {
            this._contextChangeEmitter.fire({ uri, context: this._emptyProjectContext });
            return;
        }

        // If the active document is a Razor file, we need to map it back to a C# file.
        if (languageId === 'aspnetcorerazor') {
            const virtualUri = await this.getVirtualCSharpUri(uri);
            if (!virtualUri) {
                return;
            }

            uri = virtualUri;
        }

        const contextList = await this.getProjectContexts(uri, this._source.token);
        if (!contextList) {
            return;
        }

        const context = contextList._vs_projectContexts[contextList._vs_defaultIndex];
        this._contextChangeEmitter.fire({ uri, context });
    }

    private async getVirtualCSharpUri(uri: vscode.Uri): Promise<vscode.Uri | undefined> {
        const response = await vscode.commands.executeCommand<ProvideDynamicFileResponse>(
            DynamicFileInfoHandler.provideDynamicFileInfoCommand,
            new ProvideDynamicFileParams({ uri: UriConverter.serialize(uri) })
        );

        const responseUri = response.csharpDocument?.uri;
        if (!responseUri) {
            return undefined;
        }

        return UriConverter.deserialize(responseUri);
    }

    private async getProjectContexts(
        uri: vscode.Uri,
        token: vscode.CancellationToken
    ): Promise<VSProjectContextList | undefined> {
        const uriString = UriConverter.serialize(uri);
        const textDocument = TextDocumentIdentifier.create(uriString);

        try {
            return await this._languageServer.sendRequest(
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
