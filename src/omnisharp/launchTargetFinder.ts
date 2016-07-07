/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';
import * as vscode from 'vscode';

export enum LaunchTargetKind {
	Solution,
	ProjectJson,
	Folder
}

export interface LaunchTarget {
	label: string;
	description: string;
	directory: vscode.Uri;
	resource: vscode.Uri;
	target: vscode.Uri;
	kind: LaunchTargetKind;
}

/**
 * Returns a list of potential targets on which OmniSharp can be launched.
 * This includes `project.json` files, `*.sln` files (if any `*.csproj` files are found), and the root folder
 * (if it doesn't contain a `project.json` file, but `project.json` files exist).
 */
export function findLaunchTargets(): Thenable<LaunchTarget[]> {
	if (!vscode.workspace.rootPath) {
		return Promise.resolve([]);
	}

	return vscode.workspace.findFiles(
		/*include*/ '{**/*.sln,**/*.csproj,**/project.json}', 
		/*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
		/*maxResults*/ 100)
	.then(resources => {
		return select(resources, vscode.Uri.file(vscode.workspace.rootPath));
	});
}

function select(resources: vscode.Uri[], root: vscode.Uri): LaunchTarget[] {
    // The list of launch targets is calculated like so:
	//   * If there are .csproj files, .sln files are considered as launch targets.
	//   * Any project.json file is considered a launch target.
	//   * If there is no project.json file in the root, the root as added as a launch target.
	//
	// TODO:
	//   * It should be possible to choose a .csproj as a launch target
	//   * It should be possible to choose a .sln file even when no .csproj files are found 
	//     within the root.

	if (!Array.isArray(resources)) {
		return [];
	}

	let targets: LaunchTarget[] = [],
		hasCsProjFiles = false,
		hasProjectJson = false,
		hasProjectJsonAtRoot = false;

	hasCsProjFiles = resources.some(isCSharpProject);

	resources.forEach(resource => {
		// Add .sln files if there are .csproj files
		if (hasCsProjFiles && isSolution(resource)) {
			targets.push({
				label: path.basename(resource.fsPath),
				description: vscode.workspace.asRelativePath(path.dirname(resource.fsPath)),
				resource,
				target: resource,
				directory: vscode.Uri.file(path.dirname(resource.fsPath)),
				kind: LaunchTargetKind.Solution
			});
		}

		// Add project.json files
		if (isProjectJson(resource)) {
			const dirname = path.dirname(resource.fsPath);
			hasProjectJson = true;
			hasProjectJsonAtRoot = hasProjectJsonAtRoot || dirname === root.fsPath;

			targets.push({
				label: path.basename(resource.fsPath),
				description: vscode.workspace.asRelativePath(path.dirname(resource.fsPath)),
				resource,
				target: vscode.Uri.file(dirname),
				directory: vscode.Uri.file(dirname),
				kind: LaunchTargetKind.ProjectJson
			});
		}
	});

	// Add the root folder if there are project.json files, but none in the root.
	if (hasProjectJson && !hasProjectJsonAtRoot) {
		targets.push({
			label: path.basename(root.fsPath),
			description: '',
			resource: root,
			target: root,
			directory: root,
			kind: LaunchTargetKind.Folder
		});
	}

	return targets.sort((a, b) => a.directory.fsPath.localeCompare(b.directory.fsPath));
}

function isCSharpProject(resource: vscode.Uri): boolean {
	return /\.csproj$/i.test(resource.fsPath);
}

function isSolution(resource: vscode.Uri): boolean {
	return /\.sln$/i.test(resource.fsPath);
}

function isProjectJson(resource: vscode.Uri): boolean {
	return /\project.json$/i.test(resource.fsPath);
}