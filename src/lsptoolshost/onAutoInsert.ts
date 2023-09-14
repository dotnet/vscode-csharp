/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { UriConverter } from './uriConverter';

import { FormattingOptions, TextDocumentIdentifier } from 'vscode-languageclient/node';
import * as RoslynProtocol from './roslynProtocol';
import { RoslynLanguageServer } from './roslynLanguageServer';
import { languageServerOptions } from '../shared/options';

export function registerOnAutoInsert(languageServer: RoslynLanguageServer) {
    let source = new vscode.CancellationTokenSource();
    vscode.workspace.onDidChangeTextDocument(async (e) => {
        if (!languageServerOptions.documentSelector.getValue(vscode).includes(e.document.languageId)) {
            return;
        }

        if (e.contentChanges.length > 1 || e.contentChanges.length === 0) {
            return;
        }

        const change = e.contentChanges[0];

        if (!change.range.isEmpty) {
            return;
        }

        const capabilities = await languageServer.getServerCapabilities();

        if (capabilities._vs_onAutoInsertProvider) {
            // Regular expression to match all whitespace characters except the newline character
            const changeTrimmed = change.text.replace(/[^\S\n]+/g, '');

            if (!capabilities._vs_onAutoInsertProvider._vs_triggerCharacters.includes(changeTrimmed)) {
                return;
            }

            source.cancel();
            source = new vscode.CancellationTokenSource();
            await applyAutoInsertEdit(e, changeTrimmed, languageServer, source.token);
        }
    });
}

async function applyAutoInsertEdit(
    e: vscode.TextDocumentChangeEvent,
    changeTrimmed: string,
    languageServer: RoslynLanguageServer,
    token: vscode.CancellationToken
) {
    const change = e.contentChanges[0];
    // The server expects the request position to represent the caret position in the text after the change has already been applied.
    // We need to calculate what that position would be after the change is applied and send that to the server.
    const position = new vscode.Position(
        change.range.start.line,
        change.range.start.character + (change.text.length - change.rangeLength)
    );
    const uri = UriConverter.serialize(e.document.uri);
    const textDocument = TextDocumentIdentifier.create(uri);
    const formattingOptions = getFormattingOptions();
    const request: RoslynProtocol.OnAutoInsertParams = {
        _vs_textDocument: textDocument,
        _vs_position: position,
        _vs_ch: changeTrimmed,
        _vs_options: formattingOptions,
    };

    const response = await languageServer.sendRequest(RoslynProtocol.OnAutoInsertRequest.type, request, token);
    if (response) {
        const textEdit = response._vs_textEdit;
        const startPosition = new vscode.Position(textEdit.range.start.line, textEdit.range.start.character);
        const endPosition = new vscode.Position(textEdit.range.end.line, textEdit.range.end.character);
        const docComment = new vscode.SnippetString(textEdit.newText);
        const code: any = vscode;
        const textEdits = [new code.SnippetTextEdit(new vscode.Range(startPosition, endPosition), docComment)];
        const edit = new vscode.WorkspaceEdit();
        edit.set(e.document.uri, textEdits);

        const applied = vscode.workspace.applyEdit(edit);
        if (!applied) {
            throw new Error('Tried to insert a comment but an error occurred.');
        }
    }
}

function getFormattingOptions(): FormattingOptions {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const tabSize = editorConfig.get<number>('tabSize') ?? 4;
    const insertSpaces = editorConfig.get<boolean>('insertSpaces') ?? true;
    return FormattingOptions.create(tabSize, insertSpaces);
}
