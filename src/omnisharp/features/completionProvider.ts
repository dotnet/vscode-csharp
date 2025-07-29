/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    CompletionItemProvider,
    TextDocument,
    Position,
    CompletionContext,
    CompletionList,
    CompletionItem,
    MarkdownString,
    TextEdit,
    Range,
    SnippetString,
    window,
    Selection,
    WorkspaceEdit,
    workspace,
    CompletionItemLabel,
} from 'vscode';
import AbstractProvider from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../utils';
import {
    CancellationToken,
    CompletionTriggerKind as LspCompletionTriggerKind,
    InsertTextFormat,
} from 'vscode-languageserver-protocol';
import { createRequest } from '../typeConversion';
import { LanguageMiddlewareFeature } from '../languageMiddlewareFeature';
import { OmniSharpServer } from '../server';
import { isVirtualCSharpDocument } from './virtualDocumentTracker';

export const CompletionAfterInsertCommand = 'csharp.completion.afterInsert';

export default class OmniSharpCompletionProvider extends AbstractProvider implements CompletionItemProvider {
    #lastCompletions?: Map<CompletionItem, protocol.OmnisharpCompletionItem>;

    constructor(server: OmniSharpServer, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
    }

    public async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ): Promise<CompletionList | undefined> {
        const request = createRequest<protocol.CompletionRequest>(document, position);
        request.CompletionTrigger = (context.triggerKind + 1) as LspCompletionTriggerKind;
        request.TriggerCharacter = context.triggerCharacter;

        try {
            const response = await serverUtils.getCompletion(this._server, request, token);
            let mappedItems = response.Items.map((arg) => this._convertToVscodeCompletionItem(arg, document));

            if (isVirtualCSharpDocument(document)) {
                // The `await` completion item is not compatible with all Razor scenarios.
                //
                // The `await` completion has been made smarter in that it will now update the containing method signature to include `async`, if it has not been specified.
                // This is problematic for Razor because it will now suggest making the code behind method that is "wrapping" the use of C# into an async method.
                // It makes this change by including additional text edits in the completion item.
                //
                // Example that generates an incompatible completion item:
                //
                // ```
                // @Da$$
                // ```
                //
                // Cases where you are in an async method there are no additional text edits and we can continue to offer the `await` keyword.
                //
                // Example that generates a compatible completion item:
                //
                // ```
                // @code {
                //   async Task GetNamesAsync()
                //   {
                //     var names = awa$$
                //   }
                // }
                // ```
                mappedItems = mappedItems.filter(
                    (item) => (<CompletionItemLabel>item.label).label !== 'await' || !item.additionalTextEdits
                );
            }

            const lastCompletions = new Map();

            for (let i = 0; i < mappedItems.length; i++) {
                lastCompletions.set(mappedItems[i], response.Items[i]);
            }

            this.#lastCompletions = lastCompletions;

            return { items: mappedItems };
        } catch (_) {
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
            return this._convertToVscodeCompletionItem(response.Item, item.command?.arguments?.[1] as TextDocument);
        } catch (_) {
            return item;
        }
    }

    public async afterInsert(item: protocol.OmnisharpCompletionItem, document: TextDocument) {
        try {
            const uri = document.uri;
            const response = await serverUtils.getCompletionAfterInsert(this._server, { Item: item });

            if (!response.Changes || !response.Column || !response.Line) {
                return;
            }

            let edit = new WorkspaceEdit();
            edit.set(
                uri,
                response.Changes.map((change) => ({
                    newText: change.NewText,
                    range: new Range(
                        new Position(change.StartLine, change.StartColumn),
                        new Position(change.EndLine, change.EndColumn)
                    ),
                }))
            );

            edit = await this._languageMiddlewareFeature.remap('remapWorkspaceEdit', edit, CancellationToken.None);

            const applied = await workspace.applyEdit(edit);
            if (!applied) {
                return;
            }

            const editor = window.visibleTextEditors.find((editor) => editor.document === document);
            if (editor === undefined) {
                return;
            }

            const finalPosition = new Position(response.Line, response.Column);
            editor.selections = [new Selection(finalPosition, finalPosition)];
        } catch (_) {
            return;
        }
    }

    private _convertToVscodeCompletionItem(
        omnisharpCompletion: protocol.OmnisharpCompletionItem,
        document: TextDocument
    ): CompletionItem {
        const docs: MarkdownString | undefined = omnisharpCompletion.Documentation
            ? new MarkdownString(omnisharpCompletion.Documentation, false)
            : undefined;

        const mapRange = function (edit: protocol.LinePositionSpanTextChange): Range {
            const newStart = new Position(edit.StartLine, edit.StartColumn);
            const newEnd = new Position(edit.EndLine, edit.EndColumn);
            return new Range(newStart, newEnd);
        };

        const mapTextEdit = function (edit: protocol.LinePositionSpanTextChange): TextEdit {
            return new TextEdit(mapRange(edit), edit.NewText);
        };

        const additionalTextEdits = omnisharpCompletion.AdditionalTextEdits?.map(mapTextEdit);

        const newText = omnisharpCompletion.TextEdit?.NewText ?? omnisharpCompletion.InsertText;
        const insertText =
            omnisharpCompletion.InsertTextFormat === InsertTextFormat.Snippet ? new SnippetString(newText) : newText;

        const insertRange = omnisharpCompletion.TextEdit ? mapRange(omnisharpCompletion.TextEdit) : undefined;

        return {
            label: { label: omnisharpCompletion.Label, description: omnisharpCompletion.Detail },
            kind: omnisharpCompletion.Kind - 1,
            documentation: docs,
            commitCharacters: omnisharpCompletion.CommitCharacters,
            preselect: omnisharpCompletion.Preselect,
            filterText: omnisharpCompletion.FilterText,
            insertText: insertText,
            range: insertRange,
            tags: omnisharpCompletion.Tags,
            sortText: omnisharpCompletion.SortText,
            additionalTextEdits: additionalTextEdits,
            keepWhitespace: true,
            command: omnisharpCompletion.HasAfterInsertStep
                ? { command: CompletionAfterInsertCommand, title: '', arguments: [omnisharpCompletion, document] }
                : undefined,
        };
    }
}
