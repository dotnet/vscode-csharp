/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {workspace, TextDocument, Uri} from 'vscode';
import {OmniSharpServer} from '../omnisharp/server';
import * as serverUtils from '../omnisharp/utils';
import { FileChangeType } from '../omnisharp/protocol';
import { IDisposable } from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';
import { EventStream } from '../EventStream';
import { DocumentSynchronizationFailure } from '../omnisharp/loggingEvents';

function trackCurrentVirtualDocuments(server: OmniSharpServer, eventStream: EventStream) {
    let registration = server.onProjectAdded(async () => {
        registration.dispose();

        for (let i = 0; i < workspace.textDocuments.length; i++) {
            let document = workspace.textDocuments[i];
    
            if (!shouldIgnoreDocument(document, server)) {
                await openVirtualDocument(document, server, eventStream);
            }
        }
    });
}

function trackFutureVirtualDocuments(server: OmniSharpServer, eventStream: EventStream): IDisposable {
    let onTextDocumentOpen = workspace.onDidOpenTextDocument(async document => {
        if (shouldIgnoreDocument(document, server)) {
            return;
        }

        await openVirtualDocument(document, server, eventStream);
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
        onTextDocumentClose);
}

function shouldIgnoreDocument(document: TextDocument, server: OmniSharpServer): boolean {
    if (document.uri.scheme === 'file' || document.languageId !== 'csharp') {
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
    let disposable = trackFutureVirtualDocuments(server, eventStream);
    
    return disposable;
}