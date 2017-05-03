/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {extractSummaryText} from './documentation';
import AbstractSupport from './abstractProvider';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';
import {createRequest} from '../omnisharp/typeConvertion';
import {CompletionItemProvider, CompletionItem, CompletionItemKind, CancellationToken, TextDocument, Range, Position} from 'vscode';

export default class OmniSharpCompletionItemProvider extends AbstractSupport implements CompletionItemProvider {

    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Promise<CompletionItem[]> {

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

        return serverUtils.autoComplete(this._server, req).then(responses => {

            if (!responses) {
                return;
            }

            let result: CompletionItem[] = [];
            let completions: { [c: string]: CompletionItem[] } = Object.create(null);

            // transform AutoCompleteResponse to CompletionItem and
            // group by code snippet
            for (let response of responses) {
                let completion = new CompletionItem(response.DisplayText);

                completion.detail = response.ReturnType
                    ? `${response.ReturnType} ${response.DisplayText}`
                    : response.DisplayText;

                completion.documentation = extractSummaryText(response.Description);
                completion.kind = _kinds[response.Kind] || CompletionItemKind.Property;
                completion.insertText = response.CompletionText.replace(/<>/g, '');

                let array = completions[completion.label];
                if (!array) {
                    completions[completion.label] = [completion];
                }
                else {
                    array.push(completion);
                }
            }

            // per suggestion group, select on and indicate overloads
            for (let key in completions) {

                let suggestion = completions[key][0],
                    overloadCount = completions[key].length - 1;

                if (overloadCount === 0) {
                    // remove non overloaded items
                    delete completions[key];

                }
                else {
                    // indicate that there is more
                    suggestion.detail = `${suggestion.detail} (+ ${overloadCount} overload(s))`;
                }
                
                result.push(suggestion);
            }

            return result;
        });
    }
}

const _kinds: { [kind: string]: CompletionItemKind; } = Object.create(null);

// types
_kinds['Class'] = CompletionItemKind.Class;
_kinds['Delegate'] = CompletionItemKind.Class; // need a better option for this.
_kinds['Enum'] = CompletionItemKind.Enum;
_kinds['Interface'] = CompletionItemKind.Interface;
_kinds['Struct'] = CompletionItemKind.Class; // need a better option for this.

// variables
_kinds['Local'] = CompletionItemKind.Variable;
_kinds['Parameter'] = CompletionItemKind.Variable;
_kinds['RangeVariable'] = CompletionItemKind.Variable;

// members
_kinds['EnumMember'] = CompletionItemKind.Property; // need a better option for this.
_kinds['Event'] = CompletionItemKind.Field; // need a better option for this.
_kinds['Field'] = CompletionItemKind.Field;
_kinds['Property'] = CompletionItemKind.Property;
_kinds['Method'] = CompletionItemKind.Method;

// other stuff
_kinds['Label'] = CompletionItemKind.Unit; // need a better option for this.
_kinds['Keyword'] = CompletionItemKind.Keyword;
_kinds['Namespace'] = CompletionItemKind.Module;
