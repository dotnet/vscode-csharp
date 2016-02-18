/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {spawn, ChildProcess} from 'child_process';
import {satisfies} from 'semver';

const isWindows = process.platform === 'win32';

interface LaunchResult {
	process: ChildProcess;
	serverPath: string;
}

export default function launch(serverPath: string, cwd: string, args: string[]): Promise<LaunchResult> {

	return new Promise((resolve, reject) => {
		try {
			(isWindows ? launchWindows(serverPath, cwd, args) : launchNix(serverPath, cwd, args)).then(value => {

				// async error - when target not not ENEOT
				value.process.on('error', reject);

				// success after a short freeing event loop
				setTimeout(function () {
					resolve(value);
				}, 0);
			}, err => {
				reject(err);
			});

		}
		catch (err) {
			reject(err);
		}
	});
}

function launchWindows(serverPath: string, cwd: string, args: string[]): Promise<LaunchResult> {
	args = args.slice(0);
	args.unshift(serverPath);
	args = [[
		'/s',
		'/c',
		'"' + args.map(arg => /^[^"].* .*[^"]/.test(arg) ? `"${arg}"` : arg).join(' ') + '"'
	].join(' ')];

	const process = spawn('cmd', args, <any>{
		windowsVerbatimArguments: true,
		detached: false,
		// env: details.env,
		cwd: cwd
	});

	return Promise.resolve({ process: process, serverPath: serverPath });
}

function launchNix(serverPath: string, cwd: string, args: string[]): Promise<LaunchResult>{
    
	return new Promise((resolve, reject) => {
		testForRequiredMono('>=4.0.1').then(success => {
			if (!success) {
				reject(new Error('Cannot start Omnisharp because Mono version >=4.0.1 is required. See http://go.microsoft.com/fwlink/?linkID=534832#_20001'));
			}
			else {
				resolve();
			}
		});
	}).then(_ => {
		const process = spawn(serverPath, args, {
			detached: false,
			// env: details.env,
			cwd
		});

		return { process: process, serverPath: serverPath };
	});
}

/**
 * Launch mono process with --version flag and check the content
 * of stdout for the specified versionRange.
 */
export function testForRequiredMono(versionRange?: string): Promise<boolean> {
    const versionRegExp = /(\d+\.\d+\.\d+)/;
    
	return new Promise<boolean>((resolve, reject) => {
		let childprocess: ChildProcess;
		try {
			childprocess = spawn('mono', ['--version']);
		}
		catch (err) {
			return resolve(false);
		}

		childprocess.on('error', err => {
			return resolve(false);
		});

		let stdout = '';
		childprocess.stdout.on('data', (data: NodeBuffer) => {
			stdout += data.toString();
		});

		childprocess.stdout.on('close', () => {
			let match = versionRegExp.exec(stdout);

			if (!match) {
				return resolve(false);
			}
			else if (!versionRange) {
				return resolve(true);
			}

			return resolve(satisfies(match[1], versionRange));
		});
	});
}