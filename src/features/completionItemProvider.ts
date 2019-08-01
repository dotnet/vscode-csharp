/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { extractSummaryText } from './documentation';
import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import { createRequest, toRange2 } from '../omnisharp/typeConversion';
import { CompletionItemProvider, CompletionItem, CompletionItemKind, CompletionContext, CompletionTriggerKind, CancellationToken, TextDocument, Range, Position, CompletionList, ProviderResult, TextEdit, WorkspaceEdit } from 'vscode';
import { OmniSharpServer } from '../omnisharp/server';
import CompositeDisposable from '../CompositeDisposable';

export default class OmniSharpCompletionItemProvider extends AbstractSupport implements CompletionItemProvider {

    // copied from Roslyn here: https://github.com/dotnet/roslyn/blob/6e8f6d600b6c4bc0b92bc3d782a9e0b07e1c9f8e/src/Features/Core/Portable/Completion/CompletionRules.cs#L166-L169
    private static AllCommitCharacters = [
        ' ', '{', '}', '[', ']', '(', ')', '.', ',', ':',
        ';', '+', '-', '*', '/', '%', '&', '|', '^', '!',
        '~', '=', '<', '>', '?', '@', '#', '\'', '\"', '\\'];

    private static CommitCharactersWithoutSpace = [
        '{', '}', '[', ']', '(', ')', '.', ',', ':',
        ';', '+', '-', '*', '/', '%', '&', '|', '^', '!',
        '~', '=', '<', '>', '?', '@', '#', '\'', '\"', '\\'];

    private static CommandId = "omnisharp.overrideImplement";

    constructor(server: OmniSharpServer) {
        super(server);
        let registerCommandDisposable = vscode.commands.registerCommand(OmniSharpCompletionItemProvider.CommandId, this._overrideImplement, this);
        this.addDisposables(new CompositeDisposable(registerCommandDisposable));
    }

    resolveCompletionItem(item: CompletionItem, token: CancellationToken): ProviderResult<CompletionItem> {
        setTimeout(() => { 

            item.insertText = "delay insert";
         }, 10000);

        return item;
    }

    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionList> {

        let wordToComplete = '';
        let range = document.getWordRangeAtPosition(position);
        if (range) {
            wordToComplete = document.getText(new Range(range.start, position));
        }

        let req = createRequest<protocol.AutoCompleteRequest>(document, position);
        req.WordToComplete = wordToComplete;
        req.WantDocumentationForEveryCompletionResult = true;
        req.WantKind = true;
        req.WantReturnType = true;
        if (context.triggerKind == CompletionTriggerKind.TriggerCharacter) {
            req.TriggerCharacter = context.triggerCharacter;
        }

        try {
            let responses = await serverUtils.autoComplete(this._server, req, token);

            if (!responses) {
                return;
            }

            let result: CompletionItem[] = [];
            let completions: { [c: string]: { items: CompletionItem[], preselect: boolean } } = Object.create(null);

            // transform AutoCompleteResponse to CompletionItem and
            // group by code snippet
            for (let response of responses) {
                let completion = new CompletionItem(response.CompletionText);

                completion.detail = response.ReturnType
                    ? `${response.ReturnType} ${response.DisplayText}`
                    : response.DisplayText;

                completion.documentation = extractSummaryText(response.Description);
                completion.kind = _kinds[response.Kind] || CompletionItemKind.Property;

                if (!response.OverrideTarget) {
                    completion.insertText = response.CompletionText.replace(/<>/g, '');
                } else {
                    let req = createRequest<protocol.OverrideImplementRequest>(document, position);
                    req.OverrideTarget = response.OverrideTarget;
                    completion.insertText = "";
                    completion.command = {
                        title: `Override ${response.CompletionText}`,
                        command: OmniSharpCompletionItemProvider.CommandId,
                        arguments: [req]
                    };
                }

                completion.commitCharacters = response.IsSuggestionMode
                    ? OmniSharpCompletionItemProvider.CommitCharactersWithoutSpace
                    : OmniSharpCompletionItemProvider.AllCommitCharacters;

                completion.preselect = response.Preselect;

                let completionSet = completions[completion.label];
                if (!completionSet) {
                    completions[completion.label] = { items: [completion], preselect: completion.preselect };
                }
                else {
                    completionSet.preselect = completionSet.preselect || completion.preselect;
                    completionSet.items.push(completion);
                }
            }

            // per suggestion group, select on and indicate overloads
            for (let key in completions) {

                let suggestion = completions[key].items[0],
                    overloadCount = completions[key].items.length - 1;

                if (overloadCount === 0) {
                    // remove non overloaded items
                    delete completions[key];

                }
                else {
                    // indicate that there is more
                    suggestion.detail = `${suggestion.detail} (+ ${overloadCount} overload(s))`;
                    suggestion.preselect = completions[key].preselect;
                }

                result.push(suggestion);
            }

            // for short completions (up to 1 character), treat the list as incomplete
            // because the server has likely witheld some matches due to performance constraints
            return new CompletionList(result, wordToComplete.length > 1 ? false : true);
        }
        catch (error) {
            return;
        }
    }

    private async _overrideImplement(req: protocol.OverrideImplementRequest) {
        let uri = vscode.Uri.file(req.FileName);

        let token = this._createCancellationToken(1000);
        let response = await serverUtils.overrideImplement(this._server, req, token);

        if (!token.isCancellationRequested) {
            let edits: TextEdit[] = [];
            for (let change of response.Changes) {
                let range = toRange2(change);
                edits.push(TextEdit.replace(range, change.NewText));
            }

            let edit = new WorkspaceEdit();
            edit.set(uri, edits);
            vscode.workspace.applyEdit(edit);
        }
    }

    private _createCancellationToken(timeoutMs: number): vscode.CancellationToken {
        const cancellationTokenSource = new vscode.CancellationTokenSource();

        setTimeout(() => {
            cancellationTokenSource.cancel();
        }, timeoutMs);
        return cancellationTokenSource.token;
    }
}

const _kinds: { [kind: string]: CompletionItemKind; } = Object.create(null);

// types
_kinds['Class'] = CompletionItemKind.Class;
_kinds['Delegate'] = CompletionItemKind.Class; // need a better option for this.
_kinds['Enum'] = CompletionItemKind.Enum;
_kinds['Interface'] = CompletionItemKind.Interface;
_kinds['Struct'] = CompletionItemKind.Struct;

// variables
_kinds['Local'] = CompletionItemKind.Variable;
_kinds['Parameter'] = CompletionItemKind.Variable;
_kinds['RangeVariable'] = CompletionItemKind.Variable;

// members
_kinds['Const'] = CompletionItemKind.Constant;
_kinds['EnumMember'] = CompletionItemKind.EnumMember;
_kinds['Event'] = CompletionItemKind.Event;
_kinds['Field'] = CompletionItemKind.Field;
_kinds['Method'] = CompletionItemKind.Method;
_kinds['Property'] = CompletionItemKind.Property;

// other stuff
_kinds['Label'] = CompletionItemKind.Unit; // need a better option for this.
_kinds['Keyword'] = CompletionItemKind.Keyword;
_kinds['Namespace'] = CompletionItemKind.Module;
