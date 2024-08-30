/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../disposable';
import { OmniSharpServer } from '../omnisharp/server';
import * as vscode from 'vscode';
import CompositeDisposable from '../compositeDisposable';
import * as serverUtils from '../omnisharp/utils';
import { isVirtualCSharpDocument } from './virtualDocumentTracker';

export default function fileOpenClose(server: OmniSharpServer): IDisposable {
    return new FileOpenCloseProvider(server);
}

class FileOpenCloseProvider implements IDisposable {
    private _server: OmniSharpServer;
    private _diagnostics: vscode.DiagnosticCollection;
    private _disposable: CompositeDisposable;

    constructor(server: OmniSharpServer) {
        this._server = server;
        this._diagnostics = vscode.languages.createDiagnosticCollection('csharp');

        setTimeout(async () => {
            for (const editor of vscode.window.visibleTextEditors) {
                const document = editor.document;

                await this._onDocumentOpen(document);
            }
        }, 0);

        this._disposable = new CompositeDisposable(
            this._diagnostics,
            vscode.workspace.onDidOpenTextDocument(this._onDocumentOpen, this),
            vscode.workspace.onDidCloseTextDocument(this._onDocumentClose, this),
            vscode.window.onDidChangeActiveTextEditor(this._onActiveTextEditorChange, this)
        );
    }

    private async _onDocumentOpen(e: vscode.TextDocument) {
        if (shouldIgnoreDocument(e)) {
            return;
        }

        await serverUtils.fileOpen(this._server, { FileName: e.fileName });
    }

    private async _onDocumentClose(e: vscode.TextDocument) {
        if (shouldIgnoreDocument(e)) {
            return;
        }

        await serverUtils.fileClose(this._server, { FileName: e.fileName });
    }

    private async _onActiveTextEditorChange(e: vscode.TextEditor | undefined) {
        if (e === undefined || shouldIgnoreDocument(e.document)) {
            return;
        }

        // This handler is attempting to alert O# that the current file has changed and
        // to update diagnostics. This is necessary because O# does not recompute all diagnostics
        // for the projects affected when code files are changed. We want to at least provide
        // up to date diagnostics for the active document.
        //
        // The filesChanges service notifies O# that files have changed on disk. This causes
        // the document to be reloaded from disk. If there were unsaved changes in VS Code then
        // the server is no longer aware of those changes. This is not a good fit for our needs.
        //
        // Instead we will update the buffer for the current document which causes diagnostics to be
        // recomputed.
        await serverUtils.updateBuffer(this._server, { FileName: e.document.fileName, Buffer: e.document.getText() });
    }

    dispose = () => this._disposable.dispose();
}

function shouldIgnoreDocument(document: vscode.TextDocument) {
    if (document.languageId !== 'csharp') {
        return true;
    }

    if (document.uri.scheme !== 'file' && !isVirtualCSharpDocument(document)) {
        return true;
    }

    return false;
}
