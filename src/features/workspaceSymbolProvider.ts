/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import AbstractSupport from './abstractProvider';
import * as protocol from '../protocol';
import * as serverUtils from '../omnisharpUtils';
import {createRequest, toRange} from '../typeConvertion';
import {CancellationToken, Uri, Range, WorkspaceSymbolProvider, SymbolInformation, SymbolKind} from 'vscode';


export default class OmnisharpWorkspaceSymbolProvider extends AbstractSupport implements WorkspaceSymbolProvider {

	public provideWorkspaceSymbols(search: string, token: CancellationToken): Promise<SymbolInformation[]> {

		return serverUtils.findSymbols(this._server, { Filter: search, Filename: '' }, token).then(res => {
			if (res && Array.isArray(res.QuickFixes)) {
				return res.QuickFixes.map(OmnisharpWorkspaceSymbolProvider._asSymbolInformation);
			}
		});
	}

	private static _asSymbolInformation(symbolInfo: protocol.SymbolLocation): SymbolInformation {

		return new SymbolInformation(symbolInfo.Text, OmnisharpWorkspaceSymbolProvider._toKind(symbolInfo),
			toRange(symbolInfo),
			Uri.file(symbolInfo.FileName));
	}

	private static _toKind(symbolInfo: protocol.SymbolLocation): SymbolKind {
		switch (symbolInfo.Kind) {
			case 'Method':
				return SymbolKind.Method;
			case 'Field':
			case 'Property':
				return SymbolKind.Field;
		}
		return SymbolKind.Class;
	}
}
