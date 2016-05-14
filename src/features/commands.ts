/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {OmnisharpServer} from '../omnisharpServer';
import * as serverUtils from '../omnisharpUtils';
import findLaunchTargets from '../launchTargetFinder';
import {runInTerminal} from 'run-in-terminal';
import * as path from 'path';
import * as vscode from 'vscode';

const isWindows = process.platform === 'win32';

export default function registerCommands(server: OmnisharpServer, extensionPath: string) {
	let d1 = vscode.commands.registerCommand('o.restart', () => server.restart());
	let d2 = vscode.commands.registerCommand('o.pickProjectAndStart', () => pickProjectAndStart(server));
	let d3 = vscode.commands.registerCommand('o.showOutput', () => server.getChannel().show(vscode.ViewColumn.Three));
    let d4 = vscode.commands.registerCommand('dotnet.restore', () => dotnetRestoreAllProjects(server)); 
	
    // register empty handler for csharp.installDebugger
    // running the command activates the extension, which is all we need for installation to kickoff
    let d5 = vscode.commands.registerCommand('csharp.downloadDebugger', () => { });
    
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

export function dotnetRestoreAllProjects(server: OmnisharpServer) {

	if (!server.isRunning()) {
		return Promise.reject('OmniSharp server is not running.');
	}

	return serverUtils.requestWorkspaceInformation(server).then(info => {

		let commands: Command[] = [];
        
        if ('DotNet' in info && info.DotNet.Projects.length > 0) {
            for (let project of info.DotNet.Projects) {
                commands.push({
                    label: `dotnet restore - (${project.Name || path.basename(project.Path)})`,
                    description: path.dirname(project.Path),
                    execute() {
                        return runInTerminal('dotnet', ['restore'], {
                            cwd: path.dirname(project.Path)
                        });
                    }
                });
            }
        }

		return vscode.window.showQuickPick(commands).then(command => {
			if (command) {
				return command.execute();
			}
		});
	});
}

export function dotnetRestoreForProject(server: OmnisharpServer, fileName: string) {

	return serverUtils.requestWorkspaceInformation(server).then(info => {
        if ('DotNet' in info && info.DotNet.Projects.length > 0) {
            for (let project of info.DotNet.Projects) {
                if (project.Path === path.dirname(fileName)) {
                    return runInTerminal('dotnet', ['restore', fileName], {
                        cwd: path.dirname(project.Path)
                    });
                }
            }
        }

		return Promise.reject(`Failed to execute restore, try to run 'dotnet restore' manually for ${fileName}.`);
	});
}
