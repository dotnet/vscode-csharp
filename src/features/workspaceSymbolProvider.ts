/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as Protocol from '../protocol';
import {toRange} from '../typeConvertion';
import * as vscode from 'vscode';

export default class OmnisharpWorkspaceSymbolProvider extends AbstractSupport implements vscode.WorkspaceSymbolProvider {

	public provideWorkspaceSymbols(search: string, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {

		return this._server.makeRequest<Protocol.FindSymbolsResponse>(Protocol.FindSymbols, <Protocol.FindSymbolsRequest> {
			Filter: search,
			Filename: ''
		}, token)
		.then(res => {
			if (res && Array.isArray(res.QuickFixes)) {
				return res.QuickFixes.map(OmnisharpWorkspaceSymbolProvider._asSymbolInformation);
			}
		});
	}

	private static _asSymbolInformation(symbolInfo: Protocol.SymbolLocation): vscode.SymbolInformation {

		return new vscode.SymbolInformation(symbolInfo.Text, OmnisharpWorkspaceSymbolProvider._toKind(symbolInfo),
			toRange(symbolInfo),
			vscode.Uri.file(symbolInfo.FileName));
	}

	private static _toKind(symbolInfo: Protocol.SymbolLocation): vscode.SymbolKind {
		switch (symbolInfo.Kind) {
			case 'Method':
				return vscode.SymbolKind.Method;
				
			case 'Field':
			case 'Property':
				return vscode.SymbolKind.Field;
		}
		
		return vscode.SymbolKind.Class;
	}
}
