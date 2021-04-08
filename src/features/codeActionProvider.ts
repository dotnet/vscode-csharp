/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { OmniSharpServer } from '../omnisharp/server';
import AbstractProvider from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import CompositeDisposable from '../CompositeDisposable';
import OptionProvider from '../observers/OptionProvider';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import { buildEditForResponse } from '../omnisharp/fileOperationsResponseEditBuilder';

export default class CodeActionProvider extends AbstractProvider implements vscode.CodeActionProvider {

    private _commandId: string;

    constructor(server: OmniSharpServer, private optionProvider: OptionProvider, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this._commandId = 'omnisharp.runCodeAction';
        let registerCommandDisposable = vscode.commands.registerCommand(this._commandId, this._runCodeAction, this);
        this.addDisposables(new CompositeDisposable(registerCommandDisposable));
    }

    public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<vscode.Command[]> {
        let options = this.optionProvider.GetLatestOptions();
        if (options.disableCodeActions) {
            return;
        }

        let line: number;
        let column: number;
        let selection: protocol.V2.Range;

        // VS Code will pass the range of the word at the editor caret, even if there isn't a selection.
        // To ensure that we don't suggest selection-based refactorings when there isn't a selection, we first
        // find the text editor for this document and verify that there is a selection.
        let editor = vscode.window.visibleTextEditors.find(e => e.document === document);
        if (editor) {
            if (editor.selection.isEmpty) {
                // The editor does not have a selection. Use the active position of the selection (i.e. the caret).
                let active = editor.selection.active;

                line = active.line;
                column = active.character;
            }
            else {
                // The editor has a selection. Use it.
                let start = editor.selection.start;
                let end = editor.selection.end;

                selection = {
                    Start: { Line: start.line, Column: start.character },
                    End: { Line: end.line, Column: end.character }
                };
            }
        }
        else {
            // We couldn't find the editor, so just use the range we were provided.
            selection = {
                Start: { Line: range.start.line, Column: range.start.character },
                End: { Line: range.end.line, Column: range.end.character }
            };
        }

        let request: protocol.V2.GetCodeActionsRequest = {
            FileName: document.fileName,
            Line: line,
            Column: column,
            Selection: selection
        };

        try {
            let response = await serverUtils.getCodeActions(this._server, request, token);
            return response.CodeActions.map(codeAction => {
                let runRequest: protocol.V2.RunCodeActionRequest = {
                    FileName: document.fileName,
                    Line: line,
                    Column: column,
                    Selection: selection,
                    Identifier: codeAction.Identifier,
                    WantsTextChanges: true,
                    WantsAllCodeActionOperations: true,
                    ApplyTextChanges: false
                };

                return {
                    title: codeAction.Name,
                    command: this._commandId,
                    arguments: [runRequest, token]
                };
            });
        }
        catch (error) {
            return Promise.reject(`Problem invoking 'GetCodeActions' on OmniSharp server: ${error}`);
        }
    }

    private async _runCodeAction(req: protocol.V2.RunCodeActionRequest, token: vscode.CancellationToken): Promise<boolean | string | {}> {

        return serverUtils.runCodeAction(this._server, req).then(async response => {
            if (response) {
                return buildEditForResponse(response.Changes, this._languageMiddlewareFeature, token);
            }
        }, async (error) => {
            return Promise.reject(`Problem invoking 'RunCodeAction' on OmniSharp server: ${error}`);
        });
    }
}
