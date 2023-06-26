/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';

export enum LaunchTargetKind {
    Solution,
    Project,
    ProjectJson,
    Folder,
    Csx,
    Cake,
    LiveShare
}

/**
 * Represents the project or solution that OmniSharp is to be launched with.
 * */

export interface LaunchTarget {
    label: string;
    description: string;
    directory: string;
    target: string;
    workspaceKind: LaunchTargetKind;
}

export function createLaunchTargetForSolution(resource: vscode.Uri): LaunchTarget {
    const dirname = path.dirname(resource.fsPath);
    return {
        label: path.basename(resource.fsPath),
        description: vscode.workspace.asRelativePath(dirname),
        target: resource.fsPath,
        directory: path.dirname(resource.fsPath),
        workspaceKind: LaunchTargetKind.Solution
    };
}