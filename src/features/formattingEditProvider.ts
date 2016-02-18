/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as proto from '../protocol';
import * as vscode from 'vscode';

export default class FormattingSupport extends AbstractSupport implements vscode.DocumentRangeFormattingEditProvider {

	public provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {

		let request = <proto.FormatRangeRequest>{
			Filename: document.fileName,
			Line: range.start.line + 1,
			Column: range.start.character + 1,
			EndLine: range.end.line + 1,
			EndColumn: range.end.character + 1
		};

		return this._server.makeRequest<proto.FormatRangeResponse>(proto.FormatRange, request, token).then(res => {
			if (res && Array.isArray(res.Changes)) {
				return res.Changes.map(FormattingSupport._asEditOptionation);
			}
		});
	}

	public provideOnTypeFormattingEdits(document: vscode.TextDocument, position: vscode.Position, ch: string, options: vscode.FormattingOptions, token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {

		let request = <proto.FormatAfterKeystrokeRequest> {
			Filename: document.fileName,
			Line: position.line + 1,
			Column: position.character + 1,
			Character: ch
		};

		return this._server.makeRequest<proto.FormatRangeResponse>(proto.FormatAfterKeystroke, request, token).then(res => {
			if (res && Array.isArray(res.Changes)) {
				return res.Changes.map(FormattingSupport._asEditOptionation);
			}
		});
	}

	private static _asEditOptionation(change: proto.TextChange): vscode.TextEdit {
		return new vscode.TextEdit(
			new vscode.Range(change.StartLine - 1, change.StartColumn - 1, change.EndLine - 1, change.EndColumn - 1),
			change.NewText);
	}
}
