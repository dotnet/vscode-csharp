/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import {createRequest, toRange} from '../typeConvertion';
import {DocumentHighlightProvider, DocumentHighlight, DocumentHighlightKind, Uri, CancellationToken, TextDocument, Position, Range} from 'vscode';

export default class OmnisharpDocumentHighlightProvider extends AbstractSupport implements DocumentHighlightProvider {

	public provideDocumentHighlights(resource: TextDocument, position: Position, token: CancellationToken): Promise<DocumentHighlight[]> {

		let req = createRequest<protocol.FindUsagesRequest>(resource, position);
		req.OnlyThisFile = true;
		req.ExcludeDefinition = false;

		return this._server.makeRequest<protocol.QuickFixResponse>(protocol.Requests.FindUsages, req, token).then(res => {
			if (res && Array.isArray(res.QuickFixes)) {
				return res.QuickFixes.map(OmnisharpDocumentHighlightProvider._asDocumentHighlight);
			}
		});
	}

	private static _asDocumentHighlight(quickFix: protocol.QuickFix): DocumentHighlight {
		return new DocumentHighlight(toRange(quickFix), DocumentHighlightKind.Read);
	}
}
