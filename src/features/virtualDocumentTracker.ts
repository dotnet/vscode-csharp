/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { workspace, TextDocument, Uri } from 'vscode';
import { OmniSharpServer } from '../omnisharp/server';
import * as serverUtils from '../omnisharp/utils';
import { FileChangeType } from '../omnisharp/protocol';
import { IDisposable } from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';
import { EventStream } from '../EventStream';
import { DocumentSynchronizationFailure } from '../omnisharp/loggingEvents';

async function trackCurrentVirtualDocuments(server: OmniSharpServer, eventStream: EventStream) {
    for (let i = 0; i < workspace.textDocuments.length; i++) {
        let document = workspace.textDocuments[i];

        if (!shouldIgnoreDocument(document, server)) {
            await openVirtualDocument(document, server, eventStream);
        }
    }
}

export function isVirtualCSharpDocument(document: TextDocument) {
    if (document.languageId !== 'csharp') {
        return false;
    }

    if (document.uri.scheme === 'virtualCSharp-') {
        return false;
    }

    if (!document.uri.scheme.startsWith('virtualCSharp-')) {
        return false;
    }

    return true;
}

function trackFutureVirtualDocuments(server: OmniSharpServer, eventStream: EventStream): IDisposable {
    let onTextDocumentOpen = workspace.onDidOpenTextDocument(async document => {
        if (shouldIgnoreDocument(document, server)) {
            return;
        }

        await openVirtualDocument(document, server, eventStream);
    });

    let onTextDocumentChange = workspace.onDidChangeTextDocument(async changeEvent => {
        const document = changeEvent.document;

        if (shouldIgnoreDocument(document, server)) {
            return;
        }

        await changeVirtualDocument(document, server, eventStream);
    });

    let onTextDocumentClose = workspace.onDidCloseTextDocument(async document => {
        if (shouldIgnoreDocument(document, server)) {
            return;
        }

        await closeVirtualDocument(document, server, eventStream);
    });

    // We already track text document changes for virtual documents in our change forwarder.
    return new CompositeDisposable(
        onTextDocumentOpen,
        onTextDocumentClose,
        onTextDocumentChange);
}

function shouldIgnoreDocument(document: TextDocument, server: OmniSharpServer): boolean {
    if (!isVirtualCSharpDocument(document)) {
        // We're only interested in non-physical CSharp documents.
        return true;
    }

    if (!server.isRunning()) {
        return true;
    }

    return false;
}

async function openVirtualDocument(document: TextDocument, server: OmniSharpServer, eventStream: EventStream) {
    let path = document.uri.fsPath;

    if (!path) {
        path = document.uri.path;
    }

    let req = { FileName: path, changeType: FileChangeType.Create };
    try {
        await serverUtils.filesChanged(server, [req]);

        // Trigger a change for the opening so we can get content refreshed.
        await changeVirtualDocument(document, server, eventStream);
    }
    catch (error) {
        logSynchronizationFailure(document.uri, error, server, eventStream);
    }
}

async function changeVirtualDocument(document: TextDocument, server: OmniSharpServer, eventStream: EventStream) {
    let path = document.uri.fsPath;

    if (!path) {
        path = document.uri.path;
    }

    try {
        await serverUtils.updateBuffer(server, { Buffer: document.getText(), FileName: document.fileName });
    }
    catch (error) {
        logSynchronizationFailure(document.uri, error, server, eventStream);
    }
}

async function closeVirtualDocument(document: TextDocument, server: OmniSharpServer, eventStream: EventStream) {
    let path = document.uri.fsPath;

    if (!path) {
        path = document.uri.path;
    }

    let req = { FileName: path, changeType: FileChangeType.Delete };
    try {
        await serverUtils.filesChanged(server, [req]);
    }
    catch (error) {
        logSynchronizationFailure(document.uri, error, server, eventStream);
    }
}

function logSynchronizationFailure(uri: Uri, error: any, server: OmniSharpServer, eventStream: EventStream) {
    if (server.isRunning()) {
        eventStream.post(new DocumentSynchronizationFailure(uri.path, error));
    }
}

export default function trackVirtualDocuments(server: OmniSharpServer, eventStream: EventStream): IDisposable {
    trackCurrentVirtualDocuments(server, eventStream);
    const disposable = trackFutureVirtualDocuments(server, eventStream);

    return disposable;
}