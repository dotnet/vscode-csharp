/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';
import {
    ProjectContextRefreshNotification,
    VSGetProjectContextsRequest,
    VSProjectContext,
    VSProjectContextList,
} from '../server/roslynProtocol';
import { TextDocumentIdentifier } from 'vscode-languageserver-protocol';
import { UriConverter } from '../utils/uriConverter';
import { LanguageServerEvents, ServerState } from '../server/languageServerEvents';
import { RoslynLanguageClient } from '../server/roslynLanguageClient';

export interface ProjectContextChangeEvent {
    document: vscode.TextDocument;
    isVerified: boolean;
}

type ContextKey = string;
type UriString = string;

// We want to verify the project context is in a stable state before warning the user about miscellaneous files.
const VerificationDelay = 5 * 1000;

let _verifyTimeout: NodeJS.Timeout | undefined;
let _documentUriToVerify: vscode.Uri | undefined;

export class ProjectContextService {
    // This map tracks which project context is active for a given context key. New entries are
    // added when querying the server for project contexts for a document and when a user changes
    // the active context for a document.
    private readonly _keyToActiveProjectContextMap: Map<ContextKey, VSProjectContext> = new Map();

    // This map tracks which context key a given document uri is associated with. New entries are
    // added when querying the server for project contexts for a document.
    private readonly _uriToContextKeyMap: Map<UriString, ContextKey> = new Map();

    // This map tracks how many documents are associated with a given context key. New entries are
    // added when querying the server for project contexts for a document. Entries are removed
    // when documents are no longer associated with a context key.
    private readonly _contextKeyToRefCountMap: Map<ContextKey, number> = new Map();

    private readonly _contextChangeEmitter = new vscode.EventEmitter<ProjectContextChangeEvent>();
    private _source = new vscode.CancellationTokenSource();


    public readonly emptyProjectContext: VSProjectContext = {
        _vs_id: '',
        _vs_kind: '',
        _vs_label: '',
        _vs_is_miscellaneous: false,
    };

    constructor(
        private _languageServer: RoslynLanguageServer,
        _languageClient: RoslynLanguageClient,
        _languageServerEvents: LanguageServerEvents
    ) {
        _languageServerEvents.onServerStateChange(async (e) => {
            // When the project initialization is complete, open files
            // could move from the miscellaneous workspace context into
            // an open project.
            if (e.state === ServerState.Stopped || e.state === ServerState.ProjectInitializationComplete) {
                await this.refresh();
            }
        });

        _languageClient.onNotification(ProjectContextRefreshNotification.type, async () => {
            await this.refresh();
        });

        vscode.window.onDidChangeActiveTextEditor(async (_) => this.refresh());
    }

    public get onActiveFileContextChanged(): vscode.Event<ProjectContextChangeEvent> {
        return this._contextChangeEmitter.event;
    }

    public getDocumentContext(uri: string | vscode.Uri): VSProjectContext | undefined {
        const uriString = uri instanceof vscode.Uri ? UriConverter.serialize(uri) : uri;

        const key = this._uriToContextKeyMap.get(uriString);
        if (key === undefined) {
            return undefined;
        }

        return this._keyToActiveProjectContextMap.get(key);
    }

    public async setActiveFileContext(
        document: vscode.TextDocument,
        contextList: VSProjectContextList,
        context: VSProjectContext
    ): Promise<void> {
        const uri = document.uri;
        const languageId = document.languageId;
        if (!uri || (languageId !== 'csharp' && languageId !== 'aspnetcorerazor')) {
            return;
        }

        this._keyToActiveProjectContextMap.set(contextList._vs_key, context);
        this._contextChangeEmitter.fire({
            document,
            isVerified: true
        });

        await this._languageServer.refreshFeatureProviders();
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

        const document = textEditor!.document;

        // We verify a project context is stable by waiting for a period of time
        // without any changes before sending a verified event. Changing active document
        // or receiving a new project context refresh notification cancels any pending verification.
        if (_verifyTimeout) {
            clearTimeout(_verifyTimeout);
            _verifyTimeout = undefined;
        }

        if (_documentUriToVerify) {
            _documentUriToVerify = undefined;
        }

        if (!this._languageServer.isRunning()) {
            this._contextChangeEmitter.fire({
                document,
                isVerified: false
            });
            return;
        }

        const contextList = await this.queryServerProjectContexts(document.uri, this._source.token);
        if (!contextList) {
            this._contextChangeEmitter.fire({
                document,
                isVerified: false
            });
            return;
        }

        this._contextChangeEmitter.fire({ document, isVerified: false });

        // If we do not receive a refresh even within the timeout period, send a verified event.
        _verifyTimeout = setTimeout(() => {
            this._contextChangeEmitter.fire({ document, isVerified: true });
        }, VerificationDelay);
    }

    public async queryServerProjectContexts(
        uri: string | vscode.Uri,
        token: vscode.CancellationToken
    ): Promise<VSProjectContextList | undefined> {
        const uriString = uri instanceof vscode.Uri ? UriConverter.serialize(uri) : uri;
        const textDocument = TextDocumentIdentifier.create(uriString);

        try {
            const contextList = await this._languageServer.sendRequest(
                VSGetProjectContextsRequest.type,
                { _vs_textDocument: textDocument },
                token
            );

            this.updateCaches(uriString, contextList);

            return contextList;
        } catch (error) {
            if (error instanceof vscode.CancellationError) {
                return undefined;
            }

            throw error;
        }
    }

    private updateCaches(uriString: UriString, contextList: VSProjectContextList) {
        const oldContextKey = this._uriToContextKeyMap.get(uriString);
        const newContextKey = contextList._vs_key;

        if (oldContextKey === newContextKey) {
            // We have already seen this context key and it hasn't changed, nothing to do.
            return;
        }

        if (oldContextKey !== undefined) {
            // The document is no longer associated with the old context key, so decrement
            // the ref count. If no documents are associated with the old context key, remove it.
            const oldRefCount = this._contextKeyToRefCountMap.get(oldContextKey) || 0;
            if (oldRefCount <= 1) {
                this._contextKeyToRefCountMap.delete(oldContextKey);
                this._keyToActiveProjectContextMap.delete(oldContextKey);
            } else {
                this._contextKeyToRefCountMap.set(oldContextKey, oldRefCount - 1);
            }
        }

        // Update our caches so that we can quickly lookup the active context later.
        // No need to track when there is only one context because the server will use
        // the default context automatically.

        if (contextList._vs_projectContexts.length > 1) {
            // We only get here if this is the first time we have seen this document with this
            // context key. So we need to increment the ref count in order to track it.
            const oldRefCount = this._contextKeyToRefCountMap.get(newContextKey) || 0;
            const newRefCount = oldRefCount + 1;
            this._contextKeyToRefCountMap.set(newContextKey, newRefCount);

            // Track that this document uri is associated with this context key.
            this._uriToContextKeyMap.set(uriString, newContextKey);

            // If there is not already an active context for this key, set it to the default.
            if (!this._keyToActiveProjectContextMap.has(newContextKey)) {
                const defaultContext = contextList._vs_projectContexts[contextList._vs_defaultIndex];
                this._keyToActiveProjectContextMap.set(newContextKey, defaultContext);
            }
        } else {
            // We do not need to track the context key for documents with only one context. Remove any
            // existing mapping.
            this._uriToContextKeyMap.delete(uriString);
        }
    }
}
