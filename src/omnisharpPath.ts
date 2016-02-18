/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const omnisharpEnv = 'OMNISHARP';
const isWindows = process.platform === 'win32';

export function getOmnisharpPath(): Promise<string> {

	let pathCandidate: string;

	let config = vscode.workspace.getConfiguration();
	if (config.has('csharp.omnisharp')) {
		// form config
		pathCandidate = config.get<string>('csharp.omnisharp');

	} else if (typeof process.env[omnisharpEnv] === 'string') {
		// form enviroment variable
		console.warn('[deprecated] use workspace or user settings with "csharp.omnisharp":"/path/to/omnisharp"');
		pathCandidate = process.env[omnisharpEnv];

	} else {
		// bundled version of Omnisharp
		pathCandidate = path.join(__dirname, '../bin/omnisharp')
		if (isWindows) {
			pathCandidate += '.cmd';
		}
	}

	return new Promise<string>((resolve, reject) => {
		fs.exists(pathCandidate, localExists => {
			if (localExists) {
				resolve(pathCandidate);
			} else {
				reject('OmniSharp does not exist at location: ' + pathCandidate);
			}
		});
	});
}