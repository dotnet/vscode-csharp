/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../roslynLanguageServer';
import { VSGetProjectContextsRequest, VSProjectContext, VSProjectContextList } from '../roslynProtocol';
import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { UriConverter } from '../uriConverter';

export class ProjectContextService {
    /** Track the project contexts for a particular document uri. */
    private _projectContexts: { [uri: string]: Promise<VSProjectContextList> | VSProjectContextList } = {};

    constructor(private languageServer: RoslynLanguageServer) {}

    clear() {
        this._projectContexts = {};
    }

    async getCurrentProjectContext(uri: string | vscode.Uri): Promise<VSProjectContext | undefined> {
        const projectContexts = await this.getProjectContexts(uri);
        return projectContexts?._vs_projectContexts[projectContexts._vs_defaultIndex];
    }

    async getProjectContexts(uri: string | vscode.Uri): Promise<VSProjectContextList | undefined> {
        const uriString = uri instanceof vscode.Uri ? UriConverter.serialize(uri) : uri;

        if (!(uriString in this._projectContexts)) {
            const source = new vscode.CancellationTokenSource();
            this._projectContexts[uriString] = this.languageServer
                .sendRequest(
                    VSGetProjectContextsRequest.type,
                    { _vs_textDocument: TextDocumentIdentifier.create(uriString) },
                    source.token
                )
                .then((contextList) => (this._projectContexts[uriString] = contextList));
        }

        return this._projectContexts[uriString];
    }
}
