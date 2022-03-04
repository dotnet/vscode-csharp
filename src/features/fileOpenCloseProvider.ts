import { IDisposable } from "../Disposable";
import { OmniSharpServer } from "../omnisharp/server";
import * as vscode from 'vscode';
import CompositeDisposable from "../CompositeDisposable";
import * as serverUtils from '../omnisharp/utils';
import { isVirtualCSharpDocument } from "./virtualDocumentTracker";

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
            for (let editor of vscode.window.visibleTextEditors) {
                let document = editor.document;

                await this._onDocumentOpen(document);
            }
        }, 0);

        this._disposable = new CompositeDisposable(this._diagnostics,
            vscode.workspace.onDidOpenTextDocument(this._onDocumentOpen, this),
            vscode.workspace.onDidCloseTextDocument(this._onDocumentClose, this),
            vscode.window.onDidChangeActiveTextEditor(this._onActiveTextEdtiorChnage, this)
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

    private async _onActiveTextEdtiorChnage(e: vscode.TextEditor) {
        if (shouldIgnoreDocument(e.document)) {
            return;
        }

        await serverUtils.filesChanged(this._server, [{ FileName: e.document.fileName }]);
    }

    dispose = () => this._disposable.dispose();
}

function shouldIgnoreDocument(document: vscode.TextDocument) {
    if (document.languageId !== 'csharp') {
        return true;
    }

    if (document.uri.scheme !== 'file' &&
        !isVirtualCSharpDocument(document)) {
        return true;
    }

    return false;
}