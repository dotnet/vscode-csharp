/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {spawn, ChildProcess} from 'child_process';
import {workspace, OutputChannel} from 'vscode';
import {satisfies} from 'semver';
import {getOmnisharpLaunchFilePath} from './path';
import {downloadOmnisharp, getOmnisharpAssetName} from './download';
import {SupportedPlatform, getSupportedPlatform} from '../utils';

const isWindows = process.platform === 'win32';

export interface LaunchDetails {
	cwd: string;
	args: string[];
}

export interface LaunchResult {
    process: ChildProcess;
    command: string;
}

function installOmnisharpIfNeeded(output: OutputChannel): Promise<string> {
    return getOmnisharpLaunchFilePath().catch(err => {
        if (getSupportedPlatform() == SupportedPlatform.None && process.platform === 'linux') {
            output.appendLine("[ERROR] Could not locate an OmniSharp server that supports your Linux distribution.");
            output.appendLine("");
            output.appendLine("OmniSharp provides a richer C# editing experience, with features like IntelliSense and Find All References.");
            output.appendLine("It is recommend that you download the version of OmniSharp that runs on Mono using the following steps:");
            output.appendLine("    1. If it's not already installed, download and install Mono (http://www.mono-project.com)");
            output.appendLine("    2. Download and untar https://github.com/OmniSharp/omnisharp-roslyn/releases/download/v1.9-alpha13/omnisharp-linux-mono.tar.gz");
            output.appendLine("    3. In Visual Studio Code, select Preferences->User Settings to open settings.json.");
            output.appendLine("    4. In settings.json, add a new setting: \"csharp.omnisharp\": \"/path/to/omnisharp/OmniSharp.exe\"");
            output.appendLine("    5. Restart Visual Studio Code.");
			output.show();
            throw err;
        }
		
		const logFunction = (message: string) => { output.appendLine(message); };
		const omnisharpAssetName = getOmnisharpAssetName();
		const proxy = workspace.getConfiguration().get<string>('http.proxy');
		const strictSSL = workspace.getConfiguration().get('http.proxyStrictSSL', true);

        return downloadOmnisharp(logFunction, omnisharpAssetName, proxy, strictSSL).then(_ => {
            return getOmnisharpLaunchFilePath();
        });
    });
}

export function launchOmniSharp(details: LaunchDetails, output: OutputChannel): Promise<LaunchResult> {
	return new Promise<LaunchResult>((resolve, reject) => {
		try {
			return installOmnisharpIfNeeded(output).then(command => {
				return launch(command, details).then(result => {
					// async error - when target not not ENEOT
					result.process.on('error', reject);

					// success after a short freeing event loop
					setTimeout(function () {
						resolve(result);
					}, 0);
				}, err => {
					reject(err);
				});
			});
		} catch (err) {
			reject(err);
		}
	});
}

function launch(command: string, details: LaunchDetails): Promise<LaunchResult> {
	if (isWindows) {
		return launchWindows(command, details);
	} else {
		return launchNix(command, details);
	}
}

function launchWindows(command: string, details: LaunchDetails): Promise<LaunchResult> {
	return new Promise<LaunchResult>(resolve => {

		function escapeIfNeeded(arg: string) {
			const hasSpaceWithoutQuotes = /^[^"].* .*[^"]/;
			return hasSpaceWithoutQuotes.test(arg)
				? `"${arg}"`
				: arg;
		}

		let args = details.args.slice(0); // create copy of details.args
		args.unshift(command);
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
			command
		});
	});
}

function launchNix(command: string, details: LaunchDetails): Promise<LaunchResult>{
    return new Promise<LaunchResult>(resolve => {
		let process = spawn(command, details.args, {
			detached: false,
			cwd: details.cwd
		});

		return resolve({
			process,
			command
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