/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {spawn, ChildProcess} from 'child_process';
import {satisfies} from 'semver';

const isWindows = process.platform === 'win32';

export interface LaunchDetails {
	command: string;
	cwd: string;
	args: string[];
}

export interface LaunchResult {
    process: ChildProcess;
    command: string;
}

export function launchOmniSharp(details: LaunchDetails): Promise<LaunchResult> {
	return new Promise<LaunchResult>((resolve, reject) => {
		try {
			return launch(details).then(result => {
				// async error - when target not not ENEOT
				result.process.on('error', reject);

				// success after a short freeing event loop
				setTimeout(function () {
					resolve(result);
				}, 0);
			}, err => {
				reject(err);
			});
		} catch (err) {
			reject(err);
		}
	});
}

function launch(details: LaunchDetails): Promise<LaunchResult> {
	if (isWindows) {
		return launchWindows(details);
	} else {
		return launchNix(details);
	}
}

function launchWindows(details: LaunchDetails): Promise<LaunchResult> {
	return new Promise<LaunchResult>(resolve => {

		function escapeIfNeeded(arg: string) {
			const hasSpaceWithoutQuotes = /^[^"].* .*[^"]/;
			return hasSpaceWithoutQuotes.test(arg)
				? `"${arg}"`
				: arg;
		}

		let args = details.args.slice(0); // create copy of details.args
		args.unshift(details.command);
		args = [[
			'/s',
			'/c',
			'"' + args.map(escapeIfNeeded).join(' ') + '"'
		].join(' ')];

		let process = spawn('cmd', args, <any>{
			windowsVerbatimArguments: true,
			detached: false,
			cwd: details.cwd
		});

		return resolve({
			process,
			command: details.command
		});
	});
}

function launchNix(details: LaunchDetails): Promise<LaunchResult>{
    return new Promise<LaunchResult>(resolve => {
		let process = spawn(details.command, details.args, {
			detached: false,
			cwd: details.cwd
		});

		return resolve({
			process,
			command: details.command
		});
    });

	// return new Promise((resolve, reject) => {
	// 	hasMono('>=4.0.1').then(hasIt => {
	// 		if (!hasIt) {
	// 			reject(new Error('Cannot start Omnisharp because Mono version >=4.0.1 is required. See http://go.microsoft.com/fwlink/?linkID=534832#_20001'));
	// 		} else {
	// 			resolve();
	// 		}
	// 	});
	// }).then(_ => {
	// 	return installOmnisharpIfNeeded();
	// }).then(command => {
	// 	let process = spawn(command, args, {
	// 		detached: false,
	// 		// env: details.env,
	// 		cwd
	// 	});

	// 	return {
	// 		process,
	// 		command
	// 	};
	// });
}

export function hasMono(range?: string): Promise<boolean> {
	const versionRegexp = /(\d+\.\d+\.\d+)/;

	return new Promise<boolean>((resolve, reject) => {
		let childprocess: ChildProcess;
		try {
			childprocess = spawn('mono', ['--version']);
		} catch (e) {
			return resolve(false);
		}

		childprocess.on('error', function (err: any) {
			resolve(false);
		});

		let stdout = '';
		childprocess.stdout.on('data', (data: NodeBuffer) => {
			stdout += data.toString();
		});

		childprocess.stdout.on('close', () => {
			let match = versionRegexp.exec(stdout),
				ret: boolean;

			if (!match) {
				ret = false;
			} else if (!range) {
				ret = true;
			} else {
				ret = satisfies(match[1], range);
			}

			resolve(ret);
		});
	});
}