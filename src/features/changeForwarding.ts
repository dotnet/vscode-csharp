/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { OmniSharpServer } from '../omnisharp/server';
import * as serverUtils from '../omnisharp/utils';
import * as utils from '../common';
import * as vscode from 'vscode';

function isValidDocument(document: vscode.TextDocument) {
    return !document.isUntitled
        && document.languageId === 'csharp';
}

export function registerOpenDocuments(server: OmniSharpServer) {
    utils.buildPromiseChain(vscode.workspace.textDocuments, document => {
        if (!isValidDocument(document)) {
            return;
        }

        return serverUtils.fileOpen(server, { FileName: document.fileName });
    });
}

function forwardDocumentOpenCloseEvents(server: OmniSharpServer): vscode.Disposable {
    let d1 = vscode.workspace.onDidOpenTextDocument(document => {
        if (!isValidDocument(document) ||
            !server.isRunning()) {
            return;
        }

        serverUtils.fileOpen(server, { FileName: document.fileName })
            .catch(err => {
                console.error(err);
                return err;
            });
    });

    let d2 = vscode.workspace.onDidCloseTextDocument(document => {
        if (!isValidDocument(document) ||
            !server.isRunning()) {
            return;
        }

        serverUtils.fileClose(server, { FileName: document.fileName })
            .catch(err => {
                console.error(err);
                return err;
            });
    });

    return vscode.Disposable.from(d1, d2);
}

function forwardDocumentChanges(server: OmniSharpServer): vscode.Disposable {

    return vscode.workspace.onDidChangeTextDocument(event => {

        let { document } = event;
        
        if (!isValidDocument(document) ||
            !server.isRunning()) {
            return;
        }

        serverUtils.updateBuffer(server, { Buffer: document.getText(), FileName: document.fileName }).catch(err => {
            console.error(err);
            return err;
        });
    });
}

function forwardFileChanges(server: OmniSharpServer): vscode.Disposable {

    function onFileSystemEvent(uri: vscode.Uri): void {
        if (!server.isRunning()) {
            return;
        }

        let req = { FileName: uri.fsPath };

        serverUtils.filesChanged(server, [req]).catch(err => {
            console.warn(`[o] failed to forward file change event for ${uri.fsPath}`, err);
            return err;
        });
    }

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.*');
    let d1 = watcher.onDidCreate(onFileSystemEvent);
    let d2 = watcher.onDidChange(onFileSystemEvent);
    let d3 = watcher.onDidDelete(onFileSystemEvent);

    return vscode.Disposable.from(watcher, d1, d2, d3);
}

export default function forwardChanges(server: OmniSharpServer): vscode.Disposable {

    // combine file watching and text document watching
    return vscode.Disposable.from(
        forwardDocumentOpenCloseEvents(server),
        forwardDocumentChanges(server),
        forwardFileChanges(server));
}
