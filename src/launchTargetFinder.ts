/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as paths from 'path';
import * as vscode from 'vscode';

export interface LaunchTarget {
	label: string;
	description: string;
	directory: vscode.Uri;
	resource: vscode.Uri;
	target: vscode.Uri;
}

export default function getLaunchTargets(): Thenable<LaunchTarget[]> {

	if (!vscode.workspace.rootPath) {
		return Promise.resolve([]);
	}

	return vscode.workspace.findFiles('{**/*.sln,**/*.csproj,**/project.json}', '{**/node_modules/**,**/.git/**,**/bower_components/**}', 100).then(resources => {
		return select(resources, vscode.Uri.file(vscode.workspace.rootPath));
	});
}

function select(resources: vscode.Uri[], root: vscode.Uri): LaunchTarget[] {

	if (!Array.isArray(resources)) {
		return [];
	}

	let targets: LaunchTarget[] = [];
	let hasCsProjFiles = false;
	let hasProjectJson = false;
	let hasProjectJsonAtRoot = false;

	hasCsProjFiles = resources
		.some(resource => /\.csproj$/.test(resource.fsPath));

	resources.forEach(resource => {

		// sln files
		if (hasCsProjFiles && /\.sln$/.test(resource.fsPath)) {
			targets.push({
				label: paths.basename(resource.fsPath),
				description: vscode.workspace.asRelativePath(paths.dirname(resource.fsPath)),
				resource,
				target: resource,
				directory: vscode.Uri.file(paths.dirname(resource.fsPath))
			});
		}

		// project.json files
		if (/project.json$/.test(resource.fsPath)) {

			let dirname = paths.dirname(resource.fsPath);
			hasProjectJson = true;
			hasProjectJsonAtRoot = hasProjectJsonAtRoot || dirname === root.fsPath;

			targets.push({
				label: paths.basename(resource.fsPath),
				description: vscode.workspace.asRelativePath(paths.dirname(resource.fsPath)),
				resource,
				target: vscode.Uri.file(dirname),
				directory: vscode.Uri.file(dirname)
			});
		}
	});

	if (hasProjectJson && !hasProjectJsonAtRoot) {
		targets.push({
			label: paths.basename(root.fsPath),
			description: '',
			resource: root,
			target: root,
			directory: root
		});
	}

	return targets.sort((a, b) => a.directory.fsPath.localeCompare(b.directory.fsPath));
}

