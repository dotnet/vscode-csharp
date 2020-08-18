/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CompletionItemProvider, TextDocument, Position, CompletionContext, CompletionList, CompletionItem, MarkdownString, TextEdit, Range, SnippetString } from "vscode";
import AbstractProvider from "./abstractProvider";
import * as protocol from "../omnisharp/protocol";
import * as serverUtils from '../omnisharp/utils';
import { CancellationToken, CompletionTriggerKind as LspCompletionTriggerKind, InsertTextFormat } from "vscode-languageserver-protocol";
import { createRequest } from "../omnisharp/typeConversion";

export default class OmnisharpCompletionProvider extends AbstractProvider implements CompletionItemProvider {

    #lastCompletions?: Map<CompletionItem, protocol.OmnisharpCompletionItem>;

    public async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): Promise<CompletionList> {
        let request = createRequest<protocol.CompletionRequest>(document, position);
        request.CompletionTrigger = (context.triggerKind + 1) as LspCompletionTriggerKind;
        request.TriggerCharacter = context.triggerCharacter;

        try {
            const response = await serverUtils.getCompletion(this._server, request, token);
            const mappedItems = response.Items.map(this._convertToVscodeCompletionItem);

            let lastCompletions = new Map();

            for (let i = 0; i < mappedItems.length; i++) {
                lastCompletions.set(mappedItems[i], response.Items[i]);
            }

            this.#lastCompletions = lastCompletions;

            return { items: mappedItems };
        }
        catch (error) {
            return;
        }
    }

    public async resolveCompletionItem(item: CompletionItem, token: CancellationToken): Promise<CompletionItem> {
        const lastCompletions = this.#lastCompletions;
        if (!lastCompletions) {
            return item;
        }

        const lspItem = lastCompletions.get(item);
        if (!lspItem) {
            return item;
        }

        const request: protocol.CompletionResolveRequest = { Item: lspItem };
        try {
            const response = await serverUtils.getCompletionResolve(this._server, request, token);
            return this._convertToVscodeCompletionItem(response.Item);
        }
        catch (error) {
            return;
        }
    }

    private _convertToVscodeCompletionItem(omnisharpCompletion: protocol.OmnisharpCompletionItem): CompletionItem {
        let docs: MarkdownString | undefined = omnisharpCompletion.Documentation ? new MarkdownString(omnisharpCompletion.Documentation, false) : undefined;

        const mapTextEdit = function (edit: protocol.LinePositionSpanTextChange): TextEdit {
            const newStart = new Position(edit.StartLine - 1, edit.StartColumn - 1);
            const newEnd = new Position(edit.EndLine - 1, edit.EndColumn - 1);
            const newRange = new Range(newStart, newEnd);
            return new TextEdit(newRange, edit.NewText);
        };

        const additionalTextEdits = omnisharpCompletion.AdditionalTextEdits?.map(mapTextEdit);

        const insertText = omnisharpCompletion.InsertTextFormat === InsertTextFormat.Snippet
            ? new SnippetString(omnisharpCompletion.InsertText)
            : omnisharpCompletion.InsertText;

        return {
            label: omnisharpCompletion.Label,
            kind: omnisharpCompletion.Kind - 1,
            detail: omnisharpCompletion.Detail,
            documentation: docs,
            commitCharacters: omnisharpCompletion.CommitCharacters,
            preselect: omnisharpCompletion.Preselect,
            filterText: omnisharpCompletion.FilterText,
            insertText: insertText,
            tags: omnisharpCompletion.Tags,
            sortText: omnisharpCompletion.SortText,
            additionalTextEdits: additionalTextEdits,
            keepWhitespace: true
        };
    }
}
