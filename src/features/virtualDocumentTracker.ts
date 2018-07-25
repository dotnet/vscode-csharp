/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {workspace, TextDocument} from 'vscode';
import {OmniSharpServer} from '../omnisharp/server';
import * as serverUtils from '../omnisharp/utils';
import { FileChangeType } from '../omnisharp/protocol';
import { IDisposable } from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';

function trackCurrentVirtualDocuments(server: OmniSharpServer) {
    let registration = server.onProjectAdded(() => {
        for (let i = 0; i < workspace.textDocuments.length; i++) {
            let document = workspace.textDocuments[i];
    
            if (!shouldIgnoreDocument(document, server)) {
                openVirtualDocument(document, server);
            }
        }

        registration.dispose();
    });
}

function trackFutureVirtualDocuments(server: OmniSharpServer): IDisposable {
    let onTextDocumentOpen = workspace.onDidOpenTextDocument(document => {
        if (shouldIgnoreDocument(document, server)) {
            return;
        }

        openVirtualDocument(document, server);
    });

    let onTextDocumentClose = workspace.onDidCloseTextDocument(document => {
        if (shouldIgnoreDocument(document, server)) {
            return;
        }

        closeVirtualDocument(document, server);
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

function openVirtualDocument(document: TextDocument, server: OmniSharpServer) {
    let req = { FileName: document.uri.path, changeType: FileChangeType.Create };
    serverUtils.filesChanged(server, [req])
        .catch(err => {
            console.warn(`[o] failed to forward virtual document change event for ${document.uri.path}`, err);
            return err;
        });

    serverUtils.updateBuffer(server, { Buffer: document.getText(), FileName: document.fileName })
        .catch(err => {
            console.warn(`[o] failed to forward virtual document change event for ${document.uri.path}`, err);
            return err;
        });
}

function closeVirtualDocument(document: TextDocument, server: OmniSharpServer) {
    let req = { FileName: document.uri.path, changeType: FileChangeType.Delete };
    serverUtils.filesChanged(server, [req]).catch(err => {
        console.warn(`[o] failed to forward virtual document change event for ${document.uri.path}`, err);
        return err;
    });
}

export default function trackVirtualDocuments(server: OmniSharpServer): IDisposable {
    trackCurrentVirtualDocuments(server);
    let disposable = trackFutureVirtualDocuments(server);
    
    return disposable;
}
