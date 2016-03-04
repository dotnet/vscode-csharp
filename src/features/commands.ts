/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as proto from '../protocol';
import {OmnisharpServer} from '../omnisharpServer';
import findLaunchTargets from '../launchTargetFinder';
import {runInTerminal} from 'run-in-terminal';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as vscode from 'vscode';

const isWin = /^win/.test(process.platform);

export default function registerCommands(server: OmnisharpServer, extensionPath: string) {
	let d1 = vscode.commands.registerCommand('o.restart', () => server.restart());
	let d2 = vscode.commands.registerCommand('o.pickProjectAndStart', () => pickProjectAndStart(server));
	let d3 = vscode.commands.registerCommand('dotnet.restore', () => dotnetRestoreForAll(server));
	let d4 = vscode.commands.registerCommand('o.showOutput', () => server.getChannel().show(vscode.ViewColumn.Three));
    let d5 = vscode.commands.registerCommand('csharp.addTasksJson', () => addTasksJson(server, extensionPath));
    
	return vscode.Disposable.from(d1, d2, d3, d4, d5);
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
		})
		.then(target => {
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

export function dotnetRestoreForAll(server: OmnisharpServer) {

	if (!server.isRunning()) {
		return Promise.reject('OmniSharp server is not running.');
	}

	return server.makeRequest<proto.WorkspaceInformationResponse>(proto.Projects).then(info => {

		let commands:Command[] = [];

        if ('DotNet' in info) {
            info.DotNet.Projects.forEach(project => {
                commands.push({
                    label: `dotnet restore - (${path.basename(path.dirname(project.Path))})`,
                    description: path.dirname(project.Path),
                    execute() {
                        let command = "dotnet";

                        return runInTerminal(command, ['restore'], {
                            cwd: path.dirname(project.Path)
                        });
                    }
                });
            });
        }
        else if ('Dnx' in info) {
            info.Dnx.Projects.forEach(project => {
                commands.push({
                    label: `dotnet restore - (${path.basename(path.dirname(project.Path))})`,
                    description: path.dirname(project.Path),
                    execute() {
                        let command = "dotnet";

                        return runInTerminal(command, ['restore'], {
                            cwd: path.dirname(project.Path)
                        });
                    }
                });
            });
        }

		return vscode.window.showQuickPick(commands).then(command => {
			if (command) {
				return command.execute();
			}
		});
	});
}

export function dotnetRestoreForProject(server: OmnisharpServer, fileName: string) {

	return server.makeRequest<proto.WorkspaceInformationResponse>(proto.Projects).then((info):Promise<any> => {
		for (let project of info.Dnx.Projects) {
			if (project.Path === fileName) {
                let command = "dotnet";

				return runInTerminal(command, ['restore'], {
					cwd: path.dirname(project.Path)
				});
			}
		}

		return Promise.reject(`Failed to execute restore, try to run 'dotnet restore' manually for ${fileName}.`)
	});
}

function getExpectedVsCodeFolderPath(solutionPathOrFolder: string): Promise<string> {
    return fs.lstatAsync(solutionPathOrFolder).then(stats => {
        return stats.isFile()
            ? path.join(path.dirname(solutionPathOrFolder), '.vscode')
            : path.join(solutionPathOrFolder, '.vscode');
    });
}

export function addTasksJson(server: OmnisharpServer, extensionPath: string) {
    return new Promise<string>((resolve, reject) => {
        if (!server.isRunning()) {
            return reject('OmniSharp is not running.');
        }
        
        let solutionPathOrFolder = server.getSolutionPathOrFolder();
        if (!solutionPathOrFolder)
        {
            return reject('No solution or folder open.');
        }
        
        return getExpectedVsCodeFolderPath(solutionPathOrFolder).then(vscodeFolderPath => { 
            let tasksJsonPath = path.join(vscodeFolderPath, 'tasks.json');
            
            return fs.existsAsync(tasksJsonPath).then(e => {
                if (e) {
                    return vscode.window.showInformationMessage(`${tasksJsonPath} already exists.`).then(_ => {
                        return resolve(tasksJsonPath);
                    });
                }
                else {
                    let templatePath = path.join(extensionPath, 'template-tasks.json');
                    
                    return fs.existsAsync(templatePath).then(e => {
                        if (!e) {
                            return reject('Could not find template-tasks.json file in extension.');
                        }
                        
                        return fs.ensureDirAsync(vscodeFolderPath).then(ok => {
                            if (ok) {
                                return fs.copyAsync(templatePath, tasksJsonPath).then(() => {
                                    return resolve(tasksJsonPath);
                                })
                            }
                            else {
                                return reject(`Could not create ${vscodeFolderPath} directory.`);
                            }
                        });
                    });
                }
            });
        });
    });
}