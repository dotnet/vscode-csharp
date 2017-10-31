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
	
	let workspaceInformation = await serverUtils.requestWorkspaceInformation(server);
	
	if (workspaceInformation.MsBuild && workspaceInformation.MsBuild.Projects) {
		for (let project of workspaceInformation.MsBuild.Projects) {
			tasks.push(provideBuildTask(project.AssemblyName, project.Path));
		}
	}

	if (workspaceInformation.DotNet && workspaceInformation.DotNet.Projects) {
		for (let project of workspaceInformation.DotNet.Projects) {
			tasks.push(provideBuildTask(project.Path, project.Path));
		}
	}
	
	return tasks;
}

function provideBuildTask(projectIdentifier: string, projectPath: string): vscode.Task {
	const taskDefinition: vscode.TaskDefinition = {
		type: "dotnet"
	};
	
	let task = new vscode.Task(
		taskDefinition,
		`build ${projectIdentifier}`,
		'dotnet',
		new vscode.ShellExecution(`dotnet build ${projectPath}`),
		'$msCompile'
	);
	
	task.group = vscode.TaskGroup.Build;

	task.presentationOptions = {
		reveal: TaskRevealKind.Silent
	};

	return task;
}
