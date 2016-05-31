/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {exists as fileExists} from 'fs';
import {spawn, ChildProcess} from 'child_process';
import {workspace, OutputChannel} from 'vscode';
import {satisfies} from 'semver';
import {join} from 'path';
import {getOmnisharpLaunchFilePath} from './omnisharpPath';
import {downloadOmnisharp} from './omnisharpDownload';
import {SupportedPlatform, getSupportedPlatform} from './utils';

const isWindows = process.platform === 'win32';

export interface LaunchResult {
    process: ChildProcess;
    command: string;
}

export function installOmnisharpIfNeeded(output: OutputChannel): Promise<string> {
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
		
        return downloadOmnisharp(output).then(_ => {
            return getOmnisharpLaunchFilePath();
        })
    });
}

export default function launch(output: OutputChannel, cwd: string, args: string[]): Promise<LaunchResult> {

	return new Promise<LaunchResult>((resolve, reject) => {

		try {
			(isWindows ? launchWindows(output, cwd, args) : launchNix(output, cwd, args)).then(value => {

				// async error - when target not not ENEOT
				value.process.on('error', reject);

				// success after a short freeing event loop
				setTimeout(function () {
					resolve(value);
				}, 0);
			}, err => {
				reject(err);
			});

		} catch (err) {
			reject(err);
		}
	});
}

function launchWindows(output: OutputChannel, cwd: string, args: string[]): Promise<LaunchResult> {
	return installOmnisharpIfNeeded(output).then(command => {

		args = args.slice(0);
		args.unshift(command);
		args = [[
			'/s',
			'/c',
			'"' + args.map(arg => /^[^"].* .*[^"]/.test(arg) ? `"${arg}"` : arg).join(' ') + '"'
		].join(' ')];

		let process = spawn('cmd', args, <any>{
			windowsVerbatimArguments: true,
			detached: false,
			// env: details.env,
			cwd: cwd
		});

		return {
			process,
			command
		};
	});
}

function launchNix(output: OutputChannel, cwd: string, args: string[]): Promise<LaunchResult>{
    
    return installOmnisharpIfNeeded(output).then(command => {
		let process = spawn(command, args, {
			detached: false,
			// env: details.env,
			cwd
		});

		return {
			process,
			command
		};
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

const versionRegexp = /(\d+\.\d+\.\d+)/;

export function hasMono(range?: string): Promise<boolean> {

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