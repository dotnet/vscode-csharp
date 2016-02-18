/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as Protocol from '../protocol';
import {toDocumentSymbol} from '../typeConvertion';
import * as vscode from 'vscode';

export default class OmnisharpDocumentSymbolProvider extends AbstractSupport implements vscode.DocumentSymbolProvider {

	public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {

		return this._server.makeRequest<Protocol.CurrentFileMembersAsTreeResponse>(Protocol.CurrentFileMembersAsTree, {Filename: document.fileName}, token).then(tree => {
			let ret: vscode.SymbolInformation[] = [];
			for (let node of tree.TopLevelTypeDefinitions) {
				toDocumentSymbol(ret, node);
			}
			
			return ret;
		});
	}


}

