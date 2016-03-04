/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as proto from '../protocol';
import {createRequest, toRange} from '../typeConvertion';
import * as vscode from 'vscode';

export default class OmnisharpDocumentHighlightProvider extends AbstractSupport implements vscode.DocumentHighlightProvider {

	public provideDocumentHighlights(resource: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.DocumentHighlight[]> {

		let req = createRequest<proto.FindUsagesRequest>(resource, position);
		req.OnlyThisFile = true;
		req.ExcludeDefinition = false;

		return this._server.makeRequest<proto.QuickFixResponse>(proto.FindUsages, req, token).then(res => {
			if (res && Array.isArray(res.QuickFixes)) {
				return res.QuickFixes.map(OmnisharpDocumentHighlightProvider._asDocumentHighlight);
			}
		});
	}

	private static _asDocumentHighlight(quickFix: proto.QuickFix): vscode.DocumentHighlight {
		return new vscode.DocumentHighlight(toRange(quickFix), vscode.DocumentHighlightKind.Read);
	}
}
