/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from './omnisharpServer';
import * as vscode from 'vscode';

export function downloadOmnisharp(): Promise<boolean> {
	return Promise.resolve(true);
}

export function registerInstallCommand(server: OmnisharpServer): vscode.Disposable {
	return vscode.commands.registerCommand('omnisharp.install', () => {
		var item = {
			title: 'Yes',
			command() {
				downloadOmnisharp()
					.then(success => {
						if (success) {
							server.restart();
						}
					})
			}  
		};

		vscode.window.showInformationMessage('OmniSharp provides a richer C# editing experience. Download and install?', item)
			.then(selection => {
				if (selection) {
					selection.command();
				}
			});
	});
}