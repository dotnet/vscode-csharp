/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {extractSummaryText} from './documentation';
import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../omnisharpUtils';
import {createRequest} from '../typeConvertion';
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

		return serverUtils.autoComplete(this._server, req).then(values => {

			if (!values) {
				return;
			}

			let result: CompletionItem[] = [];
			let completions: { [c: string]: CompletionItem[] } = Object.create(null);

			// transform AutoCompleteResponse to CompletionItem and
			// group by code snippet
			for (let value of values) {
				let completion = new CompletionItem(value.CompletionText.replace(/\(|\)|<|>/g, ''));
				completion.detail = value.ReturnType ? `${value.ReturnType} ${value.DisplayText}` : value.DisplayText;
				completion.documentation = extractSummaryText(value.Description);
				completion.kind = _kinds[value.Kind] || CompletionItemKind.Property;

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
_kinds['Variable'] = CompletionItemKind.Variable;
_kinds['Struct'] = CompletionItemKind.Interface;
_kinds['Interface'] = CompletionItemKind.Interface;
_kinds['Enum'] = CompletionItemKind.Enum;
_kinds['EnumMember'] = CompletionItemKind.Property;
_kinds['Property'] = CompletionItemKind.Property;
_kinds['Class'] = CompletionItemKind.Class;
_kinds['Field'] = CompletionItemKind.Field;
_kinds['EventField'] = CompletionItemKind.File;
_kinds['Method'] = CompletionItemKind.Method;
