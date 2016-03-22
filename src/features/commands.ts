/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from '../omnisharpServer';
import * as serverUtils from '../omnisharpUtils';
import findLaunchTargets from '../launchTargetFinder';
import {runInTerminal} from 'run-in-terminal';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as vscode from 'vscode';

const isWindows = process.platform === 'win32';

export default function registerCommands(server: OmnisharpServer, extensionPath: string) {
	let d1 = vscode.commands.registerCommand('o.restart', () => server.restart());
	let d2 = vscode.commands.registerCommand('o.pickProjectAndStart', () => pickProjectAndStart(server));
	let d3 = vscode.commands.registerCommand('o.restore', () => dnxRestoreForAll(server));
	let d4 = vscode.commands.registerCommand('o.execute', () => dnxExecuteCommand(server));
	let d5 = vscode.commands.registerCommand('o.execute-last-command', () => dnxExecuteLastCommand(server));
	let d6 = vscode.commands.registerCommand('o.showOutput', () => server.getChannel().show(vscode.ViewColumn.Three));
    let d7 = vscode.commands.registerCommand('dotnet.restore', () => dotnetRestore(server)); 
    
	return vscode.Disposable.from(d1, d2, d3, d4, d5, d6, d7);
}

function pickProjectAndStart(server: OmnisharpServer) {

	return findLaunchTargets().then(targets => {

		let currentPath = server.getSolutionPathOrFolder();
		if (currentPath) {
			for (let target of targets) {
				if (target.target.fsPath === currentPath) {
					target.label = `\u2713 ${target.label}`;
				}
			}
		}

		return vscode.window.showQuickPick(targets, {
			matchOnDescription: true,
			placeHolder: `Select 1 of ${targets.length} projects`
		}).then(target => {
			if (target) {
				return server.restart(target.target.fsPath);
			}
		});
	});
}

interface Command {
	label: string;
	description: string;
	execute(): Thenable<any>;
}

let lastCommand: Command;

function dnxExecuteLastCommand(server: OmnisharpServer) {
	if (lastCommand) {
		lastCommand.execute();
	} else {
		dnxExecuteCommand(server);
	}
}

function dnxExecuteCommand(server: OmnisharpServer) {

	if (!server.isRunning()) {
		return Promise.reject('OmniSharp server is not running.');
	}

	return serverUtils.requestWorkspaceInformation(server).then(info => {

		let commands: Command[] = [];

		info.Dnx.Projects.forEach(project => {
			Object.keys(project.Commands).forEach(key => {

				commands.push({
					label: `dnx ${key} - (${project.Name || path.basename(project.Path)})`,
					description: path.dirname(project.Path),
					execute() {
						lastCommand = this;

						let command = path.join(info.Dnx.RuntimePath, 'bin/dnx');
						let args = [key];

						// dnx-beta[1-6] needs a leading dot, like 'dnx . run'
						if (/-beta[1-6]/.test(info.Dnx.RuntimePath)) {
							args.unshift('.');
						}

						if (isWindows) {
							command += '.exe';
						}

						return runInTerminal(command, args, {
							cwd: path.dirname(project.Path),
							env: {
								// KRE_COMPILATION_SERVER_PORT: workspace.DesignTimeHostPort
							}
						});
					}
				});
			});
		});

		return vscode.window.showQuickPick(commands).then(command => {
			if (command) {
				return command.execute();
			}
		});
	});
}

export function dnxRestoreForAll(server: OmnisharpServer) {

	if (!server.isRunning()) {
		return Promise.reject('OmniSharp server is not running.');
	}

	return serverUtils.requestWorkspaceInformation(server).then(info => {

		let commands:Command[] = [];

		info.Dnx.Projects.forEach(project => {
			commands.push({
				label: `dnu restore - (${project.Name || path.basename(project.Path)})`,
				description: path.dirname(project.Path),
				execute() {

					let command = path.join(info.Dnx.RuntimePath, 'bin/dnu');
					if (isWindows) {
						command += '.cmd';
					}

					return runInTerminal(command, ['restore'], {
						cwd: path.dirname(project.Path)
					});
				}
			});
		});

		return vscode.window.showQuickPick(commands).then(command => {
			if(command) {
				return command.execute();
			}
		});
	});
}

export function dnxRestoreForProject(server: OmnisharpServer, fileName: string) {

	return serverUtils.requestWorkspaceInformation(server).then((info):Promise<any> => {
		for(let project of info.Dnx.Projects) {
			if (project.Path === fileName) {
				let command = path.join(info.Dnx.RuntimePath, 'bin/dnu');
				if (isWindows) {
					command += '.cmd';
				}

				return runInTerminal(command, ['restore'], {
					cwd: path.dirname(project.Path)
				});
			}
		}

		return Promise.reject(`Failed to execute restore, try to run 'dnu restore' manually for ${fileName}.`);
	});
}

function dotnetRestore(server: OmnisharpServer) {

    if (!server.isRunning()) {
        return Promise.reject('OmniSharp server is not running.');
    }

    let solutionPathOrFolder = server.getSolutionPathOrFolder();
    if (!solutionPathOrFolder) {
        return Promise.reject('No solution or folder open.');
    }

    getFolderPath(solutionPathOrFolder).then(folder => {
        return runInTerminal('dotnet', ['restore'], {
            cwd: folder
        });
    });
}

function getFolderPath(fileOrFolderPath: string): Promise<string> {
    return fs.lstatAsync(fileOrFolderPath).then(stats => {
        return stats.isFile()
            ? path.dirname(fileOrFolderPath)
            : fileOrFolderPath;
    });
}