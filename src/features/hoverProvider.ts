/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {plain} from './documentation';
import AbstractSupport from './abstractProvider';
import * as Protocol from '../protocol';
import {createRequest} from '../typeConvertion';
import * as vscode from 'vscode';

export default class OmniSharpHoverProvider extends AbstractSupport implements vscode.HoverProvider {

	public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {

		let req = createRequest<Protocol.TypeLookupRequest>(document, position);
		req.IncludeDocumentation = true;

		return this._server.makeRequest<Protocol.TypeLookupResponse>(Protocol.TypeLookup, req, token).then(value => {
			if (value && value.Type) {
				let contents = [plain(value.Documentation), { language: 'csharp', value: value.Type }];
				return new vscode.Hover(contents);
			}
		});
	}
}
