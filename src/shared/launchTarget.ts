/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

export interface LaunchTarget {
    label: string;
    description: string;
    target: string;
}

export function createLaunchTargetForSolution(resource: vscode.Uri): LaunchTarget {
    const directoryPath = path.dirname(resource.fsPath);
    const relativePath = vscode.workspace.asRelativePath(directoryPath);
    return {
        label: path.basename(resource.fsPath),
        // When the relativePath matches the directoryPath, it means we are in the root of the workspace.
        description: directoryPath === relativePath ? '' : relativePath,
        target: resource.fsPath,
    };
}
