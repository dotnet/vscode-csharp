/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as Protocol from '../protocol';
import {createRequest, toLocation} from '../typeConvertion';
import * as vscode from 'vscode';

export default class CSharpDefinitionProvider extends AbstractSupport implements vscode.DefinitionProvider {

	public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location> {

		let req = createRequest(document, position);

		return this._server.makeRequest<Protocol.ResourceLocation>(Protocol.GoToDefinition, req, token).then(value => {
			if (value && value.FileName) {
				return toLocation(value);
			}
		});
	}
}
