/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as serverUtils from './omnisharp/utils';
import * as vscode from './vscodeAdapter';

import { OmniSharpServer } from './omnisharp/server';
import { TaskRevealKind } from 'vscode';

let taskProvider: vscode.Disposable | undefined;

export function activate(_context: vscode.ExtensionContext, server: OmniSharpServer): void {
	if (!vscode.workspace.workspaceFolders) {
		return;
	}

	taskProvider = vscode.workspace.registerTaskProvider('dotnet', {
		provideTasks: () => {
			return provideDotnetTasks(server);
		},
		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			return undefined;
		}
	});
}

export function deactivate(): void {
	if (taskProvider) {
		taskProvider.dispose();
	}
}

async function provideDotnetTasks(server: OmniSharpServer): Promise<vscode.Task[]> {
	let tasks: vscode.Task[] = [];
	let taskDefinition: vscode.TaskDefinition = {
		type: "dotnet"
	};
	
	return serverUtils.requestWorkspaceInformation(server).then(info => {
		if (info.MsBuild && info.MsBuild.Projects) {
			for (let project of info.MsBuild.Projects) {
				let task = new vscode.Task(
						taskDefinition,
						`build ${project.AssemblyName}`,
						'dotnet',
						new vscode.ShellExecution(
							`dotnet build ${project.Path}`, {
								executable: 'dotnet',
								shellArgs: [`${project.AssemblyName}`]
							}),
						'$msCompile'
					);
				
				task.group = vscode.TaskGroup.Build;

				task.presentationOptions = {
					reveal: TaskRevealKind.Silent
				};

				tasks.push(task);
			}
		}

		if (info.DotNet && info.DotNet.Projects) {
			for (let project of info.DotNet.Projects) {
				tasks.push(new vscode.Task(
						taskDefinition,
						`build ${project.Path}`,
						'dotnet',
						new vscode.ShellExecution(`dotnet build ${project.Path}`),
						'$msCompile'
					)
				);
			}
		}
		
		return tasks;
	}).catch(r =>{
		console.log(r);
		
		return tasks;
	});
}
