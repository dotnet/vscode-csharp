/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { OmniSharpServer } from '../omnisharp/server';
import AbstractProvider from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import CompositeDisposable from '../compositeDisposable';
import { LanguageMiddlewareFeature } from '../omnisharp/languageMiddlewareFeature';
import { buildEditForResponse } from '../omnisharp/fileOperationsResponseEditBuilder';
import { omnisharpOptions } from '../shared/options';

export default class OmniSharpCodeActionProvider
    extends AbstractProvider
    implements vscode.CodeActionProvider<vscode.CodeAction>
{
    private _commandId: string;

    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this._commandId = 'omnisharp.runCodeAction';
        const registerCommandDisposable = vscode.commands.registerCommand(this._commandId, this._runCodeAction, this);
        this.addDisposables(new CompositeDisposable(registerCommandDisposable));
    }

    public async provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CodeAction[] | undefined> {
        if (omnisharpOptions.disableCodeActions) {
            return;
        }

        const line = range.start.line;
        const column = range.start.character;

        const request: protocol.V2.GetCodeActionsRequest = {
            FileName: document.fileName,
            Line: line,
            Column: column,
        };

        // Only suggest selection-based refactorings when a selection exists.
        // If there is no selection and the editor isn't focused,
        // VS Code will pass us an empty Selection rather than a Range,
        // hence the extra range.isEmpty check.
        if (range instanceof vscode.Selection && !range.isEmpty) {
            request.Selection = {
                Start: { Line: range.start.line, Column: range.start.character },
                End: { Line: range.end.line, Column: range.end.character },
            };
        }

        try {
            const response = await serverUtils.getCodeActions(this._server, request, token);
            return response.CodeActions.map((codeAction) => {
                const runRequest: protocol.V2.RunCodeActionRequest = {
                    ...request,
                    Identifier: codeAction.Identifier,
                    WantsTextChanges: true,
                    WantsAllCodeActionOperations: true,
                    ApplyTextChanges: false,
                };

                return {
                    title: codeAction.Name,
                    kind: this.mapOmniSharpCodeActionKindToVSCodeCodeActionKind(codeAction.CodeActionKind),
                    command: {
                        title: codeAction.Name,
                        command: this._commandId,
                        arguments: [runRequest, token],
                    },
                };
            });
        } catch (error) {
            return Promise.reject(new Error(`Problem invoking 'GetCodeActions' on OmniSharp server: ${error}`));
        }
    }

    private mapOmniSharpCodeActionKindToVSCodeCodeActionKind(kind: string | undefined): vscode.CodeActionKind {
        switch (kind) {
            case 'QuickFix':
                return vscode.CodeActionKind.QuickFix;
            case 'Refactor':
                return vscode.CodeActionKind.Refactor;
            case 'RefactorExtract':
                return vscode.CodeActionKind.RefactorExtract;
            case 'RefactorInline':
                return vscode.CodeActionKind.RefactorInline;
            default:
                return vscode.CodeActionKind.Empty;
        }
    }

    private async _runCodeAction(
        req: protocol.V2.RunCodeActionRequest,
        token: vscode.CancellationToken
    ): Promise<boolean | string | undefined> {
        try {
            const response = await serverUtils.runCodeAction(this._server, req);
            if (response) {
                return buildEditForResponse(response.Changes, this._languageMiddlewareFeature, token);
            }
        } catch (error) {
            return Promise.reject(new Error(`Problem invoking 'RunCodeAction' on OmniSharp server: ${error}`));
        }

        return undefined;
    }
}
