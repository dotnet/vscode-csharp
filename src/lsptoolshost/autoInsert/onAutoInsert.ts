/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { FormattingOptions, LanguageClient, TextDocumentIdentifier } from 'vscode-languageclient/node';
import * as RoslynProtocol from '../server/roslynProtocol';
import { RoslynLanguageServer } from '../server/roslynLanguageServer';

export function registerOnAutoInsert(languageServer: RoslynLanguageServer, languageClient: LanguageClient) {
    let source = new vscode.CancellationTokenSource();

    // We explicitly register against the server's didChange notification (instead of the VSCode workspace API)
    // as we want to ensure that the server has processed the change before we request edits from auto insert.
    // The VSCode workspace API will sometimes call this before the LSP client can send the change, leading to auto insert not working.
    languageClient.getFeature('textDocument/didChange').onNotificationSent(async (event) => {
        const e = event.params;
        if (e.contentChanges.length > 1 || e.contentChanges.length === 0) {
            return;
        }

        const change = e.contentChanges[0];
        // TextDocumentContentChangeEvent is a union type that does not return a range if the change event is for a full document.
        // Full document changes are not supported for onautoinsert.
        if (!('range' in change)) {
            return;
        }

        // Convert to a VSCode range for ease of handling.
        const vscodeRange = languageClient.protocol2CodeConverter.asRange(change.range);

        // Empty or multiline changes are not supported for onautoinsert.
        if (!vscodeRange.isEmpty || !vscodeRange.isSingleLine) {
            return;
        }

        // We need to convert to a vscode TextDocument to apply the correct capabilities.
        const uri = languageClient.protocol2CodeConverter.asUri(e.textDocument.uri);
        // This is a no-op because the document is already open (in order to be edited).
        const document = await vscode.workspace.openTextDocument(uri);

        const onAutoInsertFeature = languageServer.getOnAutoInsertFeature();
        const onAutoInsertOptions = onAutoInsertFeature?.getOptions(document);
        const vsTriggerCharacters = onAutoInsertOptions?._vs_triggerCharacters;

        if (vsTriggerCharacters === undefined) {
            return;
        }

        // Regular expression to match all whitespace characters except the newline character
        const changeTrimmed = change.text.replace(/[^\S\n]+/g, '');

        if (!vsTriggerCharacters.includes(changeTrimmed)) {
            return;
        }

        // We have a single line range so we can compute the length by comparing the start and end character positions.
        const rangeLength = vscodeRange.end.character - vscodeRange.start.character;

        // The server expects the request position to represent the caret position in the text after the change has already been applied.
        // We need to calculate what that position would be after the change is applied and send that to the server.
        const position = vscodeRange.start.translate(0, change.text.length - rangeLength);

        source.cancel();
        source = new vscode.CancellationTokenSource();
        try {
            await applyAutoInsertEdit(position, changeTrimmed, e.textDocument, uri, languageServer, source.token);
        } catch (e) {
            if (e instanceof vscode.CancellationError) {
                return;
            }

            throw e;
        }
    });
}

async function applyAutoInsertEdit(
    position: vscode.Position,
    changeTextTrimmed: string,
    textDocumentIdentifier: TextDocumentIdentifier,
    uri: vscode.Uri,
    languageServer: RoslynLanguageServer,
    token: vscode.CancellationToken
) {
    const formattingOptions = getFormattingOptions();
    const request: RoslynProtocol.OnAutoInsertParams = {
        _vs_textDocument: textDocumentIdentifier,
        _vs_position: position,
        _vs_ch: changeTextTrimmed,
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
        edit.set(uri, textEdits);

        const applied = vscode.workspace.applyEdit(edit);
        if (!applied) {
            throw new Error('Tried to apply an edit but an error occurred.');
        }

        if (response.command !== undefined) {
            await vscode.commands.executeCommand(response.command.command, response.command.arguments);
        }
    }
}

function getFormattingOptions(): FormattingOptions {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    const tabSize = editorConfig.get<number>('tabSize') ?? 4;
    const insertSpaces = editorConfig.get<boolean>('insertSpaces') ?? true;
    return FormattingOptions.create(tabSize, insertSpaces);
}
