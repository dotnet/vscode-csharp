/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {plain} from './documentation';
import AbstractSupport from './abstractProvider';
import * as proto from '../protocol';
import {createRequest} from '../typeConvertion';
import * as vscode from 'vscode';

export default class OmniSharpCompletionItemProvider extends AbstractSupport implements vscode.CompletionItemProvider {

	public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[]> {

		let wordToComplete = '';
		let range = document.getWordRangeAtPosition(position);
		if (range) {
			wordToComplete = document.getText(new vscode.Range(range.start, position));
		}

		let req = createRequest<proto.AutoCompleteRequest>(document, position);
		req.WordToComplete = wordToComplete;
		req.WantDocumentationForEveryCompletionResult = true;
		req.WantKind = true;

		return this._server.makeRequest<proto.AutoCompleteResponse[]>(proto.AutoComplete, req).then(values => {

			if (!values) {
				return;
			}

			let result: vscode.CompletionItem[] = [];
			let completions: { [c: string]: vscode.CompletionItem[] } = Object.create(null);

			// transform AutoCompleteResponse to CompletionItem and
			// group by code snippet
			for (let value of values) {
				let completion = new vscode.CompletionItem(value.CompletionText.replace(/\(|\)|<|>/g, ''));
				completion.detail = value.DisplayText;
				completion.documentation = plain(value.Description);
				completion.kind = _kinds[value.Kind] || vscode.CompletionItemKind.Property;

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

const _kinds: { [kind: string]: vscode.CompletionItemKind; } = Object.create(null);
_kinds['Variable'] = vscode.CompletionItemKind.Variable;
_kinds['Struct'] = vscode.CompletionItemKind.Interface;
_kinds['Interface'] = vscode.CompletionItemKind.Interface;
_kinds['Enum'] = vscode.CompletionItemKind.Enum;
_kinds['EnumMember'] = vscode.CompletionItemKind.Property;
_kinds['Property'] = vscode.CompletionItemKind.Property;
_kinds['Class'] = vscode.CompletionItemKind.Class;
_kinds['Field'] = vscode.CompletionItemKind.Field;
_kinds['EventField'] = vscode.CompletionItemKind.File;
_kinds['Method'] = vscode.CompletionItemKind.Method;
