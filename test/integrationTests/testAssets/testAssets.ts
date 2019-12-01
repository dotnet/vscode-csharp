/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as vscode from 'vscode';
import spawnGit from './spawnGit';

export class TestAssetProject {
    constructor(project: ITestAssetProject) {
        this.relativeFilePath = project.relativeFilePath;
    }

    relativeFilePath: string;

    get projectDirectoryPath(): string {
        return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath,
            path.dirname(this.relativeFilePath));
    }

    async addFileWithContents(fileName: string, contents: string): Promise<vscode.Uri> {
        let dir = this.projectDirectoryPath;
        let loc = path.join(dir, fileName);
        await fs.writeTextFile(loc, contents);
        return vscode.Uri.file(loc);
    }
}

export class TestAssetWorkspace {
    constructor(workspace: ITestAssetWorkspace) {
        this.projects = workspace.projects.map(
            w => new TestAssetProject(w)
        );

        this.description = workspace.description;
    }

    async restore(): Promise<void> {
        await vscode.commands.executeCommand("dotnet.restore.all");
    }

    get vsCodeDirectoryPath(): string {
        return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, ".vscode");
    }

    get launchJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, "launch.json");
    }

    get tasksJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, "tasks.json");
    }

    async cleanupWorkspace(): Promise<void> {
        let workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        let cleanUpRoutine = async () => {
            await vscode.commands.executeCommand("workbench.action.closeAllEditors");
            await spawnGit(["clean", "-xdf", "."], { cwd: workspaceRootPath });
            await spawnGit(["checkout", "--", "."], { cwd: workspaceRootPath });
        };

        let sleep = async () => new Promise((resolve) => setTimeout(resolve, 2 * 1000));

        try {
            await cleanUpRoutine();
        } catch (error) {
            // Its possible that cleanup fails for locked files etc, for this reason retry is added.
            await sleep();
            await cleanUpRoutine();
        }
    }

    description: string;

    projects: TestAssetProject[];
}

export interface ITestAssetProject {
    relativeFilePath: string;
}

export interface ITestAssetWorkspace {
    description: string;
    projects: ITestAssetProject[];
}