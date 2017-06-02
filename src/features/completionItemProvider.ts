/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import { V2 as protocol } from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import * as vscode from 'vscode';

class OmniSharpCompletionItem extends vscode.CompletionItem {

    readonly fileName: string;
    readonly itemIndex: number;

    constructor(label: string, kind: vscode.CompletionItemKind, fileName: string, itemIndex: number) {
        super(label, kind);
        this.fileName = fileName;
        this.itemIndex = itemIndex;
    }
}

export default class OmniSharpCompletionItemProvider extends AbstractSupport implements vscode.CompletionItemProvider {

    // copied from Roslyn here: https://github.com/dotnet/roslyn/blob/6e8f6d600b6c4bc0b92bc3d782a9e0b07e1c9f8e/src/Features/Core/Portable/Completion/CompletionRules.cs#L166-L169
    private static DefaultCommitCharacters = [
        ' ', '{', '}', '[', ']', '(', ')', '.', ',', ':',
        ';', '+', '-', '*', '/', '%', '&', '|', '^', '!',
        '~', '=', '<', '>', '?', '@', '#', '\'', '\"', '\\'];

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionList> {
        let request: protocol.CompletionRequest = {
            FileName: document.fileName,
            Position: document.offsetAt(position),
            Trigger: this._createTrigger(document, position)
        };

        return serverUtils.completion(this._server, request)
            .then(response => {
                let items: vscode.CompletionItem[] = [];

                for (let index = 0; index < response.Items.length; index++) {
                    let item = response.Items[index];
                    let kind = _kinds[item.Kind] || vscode.CompletionItemKind.Property;

                    let newItem = new OmniSharpCompletionItem(item.DisplayText, kind, document.fileName, index);
                    newItem.filterText = item.FilterText;
                    newItem.sortText = item.SortText;

                    items.push(newItem);
                }

                return new vscode.CompletionList(items, /*isIncomplete*/ false);
            });
    }

    public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): Promise<vscode.CompletionItem> {
        if (item instanceof OmniSharpCompletionItem) {
            let request: protocol.CompletionItemResolveRequest = {
                FileName: item.fileName,
                ItemIndex: item.itemIndex,
                DisplayText: item.label
            };

            return serverUtils.completionItemResolve(this._server, request)
                .then(response => {
                    item.documentation = response.Item.Description;
                    item.insertText = response.Item.TextEdit.NewText;
                    item.range = protocol.toRange(response.Item.TextEdit.Range);

                    return item;
                });
        }
    }

    private _createTrigger(document: vscode.TextDocument, position: vscode.Position): protocol.CompletionTrigger {
        // Currently, there's no good way to determine *how* completion was trigger (e.g. by typing, by specifically invoking, etc.)
        //
        //   * If the position is at the start of a line, we assume that completion was triggered by specifically
        //     invoking it (e.g. Ctrl+Space), and specify a 'default' trigger.
        //   * If the position is after the start of a line, we assume that completion was triggered by typing and
        //     specify an 'insertion' trigger with the character to the left of the position.

        if (position.character === 0) {
            return {
                Kind: protocol.CompletionTriggerKind.Invoke
            };
        }

        let characterToLeft = new vscode.Range(new vscode.Position(position.line, position.character - 1), position);

        return {
            Kind: protocol.CompletionTriggerKind.Insertion,
            Character: document.getText(characterToLeft)
        };
    }
}

const _kinds: { [kind: string]: vscode.CompletionItemKind; } = Object.create(null);

// There are two potential kinds that are not covered below: 'Intrinsic' and 'Reference'.
// However, it's not clear that this every show up in practice.

_kinds['Class'] = vscode.CompletionItemKind.Class;
_kinds['Constant'] = vscode.CompletionItemKind.Constant;
_kinds['Delegate'] = vscode.CompletionItemKind.Class; // need a better option for this.
_kinds['Enum'] = vscode.CompletionItemKind.Enum;
_kinds['EnumMember'] = vscode.CompletionItemKind.EnumMember;
_kinds['Event'] = vscode.CompletionItemKind.Event;
_kinds['ExtensionMethod'] = vscode.CompletionItemKind.Method;
_kinds['Field'] = vscode.CompletionItemKind.Field;
_kinds['Interface'] = vscode.CompletionItemKind.Interface;
_kinds['Keyword'] = vscode.CompletionItemKind.Keyword;
_kinds['Label'] = vscode.CompletionItemKind.Unit; // need a better option for this.
_kinds['Local'] = vscode.CompletionItemKind.Variable;
_kinds['Method'] = vscode.CompletionItemKind.Method;
_kinds['Module'] = vscode.CompletionItemKind.Module;
_kinds['Namespace'] = vscode.CompletionItemKind.Module;
_kinds['Operator'] = vscode.CompletionItemKind.Operator;
_kinds['Parameter'] = vscode.CompletionItemKind.Variable;
_kinds['Property'] = vscode.CompletionItemKind.Property;
_kinds['RangeVariable'] = vscode.CompletionItemKind.Variable;
_kinds['Structure'] = vscode.CompletionItemKind.Struct;
_kinds['TypeParameter'] = vscode.CompletionItemKind.TypeParameter;

