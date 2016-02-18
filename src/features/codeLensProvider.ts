/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import {toRange, toLocation} from '../typeConvertion';
import AbstractSupport from './abstractProvider';
import * as proto from '../protocol';

class OmniSharpCodeLens extends vscode.CodeLens {

	fileName: string;

	constructor(fileName: string, range: vscode.Range) {
		super(range);
		this.fileName = fileName;
	}
}

export default class OmniSharpCodeLensProvider extends AbstractSupport implements vscode.CodeLensProvider {

	private static filteredSymbolNames: { [name: string]: boolean } = {
		'Equals': true,
		'Finalize': true,
		'GetHashCode': true,
		'ToString': true
	};

	provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {

		return this._server.makeRequest<proto.CurrentFileMembersAsTreeResponse>(proto.CurrentFileMembersAsTree, {
			Filename: document.fileName
		}, token)
		.then(tree => {
			const ret: vscode.CodeLens[] = [];
			tree.TopLevelTypeDefinitions.forEach(node => OmniSharpCodeLensProvider._convertQuickFix(ret, document.fileName, node));
			return ret;
		});
	}

	private static _convertQuickFix(bucket: vscode.CodeLens[], fileName:string, node: proto.Node): void {

		if (node.Kind === 'MethodDeclaration' && OmniSharpCodeLensProvider.filteredSymbolNames[node.Location.Text]) {
			return;
		}

		let lens = new OmniSharpCodeLens(fileName, toRange(node.Location));
		bucket.push(lens);

		for (let child of node.ChildNodes) {
			OmniSharpCodeLensProvider._convertQuickFix(bucket, fileName, child);
		}
	}

	resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): Thenable<vscode.CodeLens> {
		if (codeLens instanceof OmniSharpCodeLens) {

			let req = <proto.FindUsagesRequest>{
				Filename: codeLens.fileName,
				Line: codeLens.range.start.line + 1,
				Column: codeLens.range.start.character + 1,
				OnlyThisFile: false,
				ExcludeDefinition: true
			};

			return this._server.makeRequest<proto.QuickFixResponse>(proto.FindUsages, req, token).then(res => {
				if (!res || !Array.isArray(res.QuickFixes)) {
					return;
				}
				
				let len = res.QuickFixes.length;
				codeLens.command = {
					title: len === 1 ? '1 reference' : `${len} references`,
					command: 'editor.action.showReferences',
					arguments: [vscode.Uri.file(req.Filename), codeLens.range.start, res.QuickFixes.map(toLocation)]
				};

				return codeLens;
			});
		}
	}
}
