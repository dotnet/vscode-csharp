/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as vscode from 'vscode';
import spawnGit from '../../../test/integrationTests/testAssets/spawnGit';
import { execChildProcess } from '../../../src/common';

export class TestAssetProject {
    constructor(project: ITestAssetProject) {
        this.relativeFilePath = project.relativeFilePath;
    }

    relativeFilePath: string;

    get projectDirectoryPath(): string {
        return path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, path.dirname(this.relativeFilePath));
    }

    async addFileWithContents(fileName: string, contents: string): Promise<vscode.Uri> {
        const dir = this.projectDirectoryPath;
        const loc = path.join(dir, fileName);
        await fs.writeTextFile(loc, contents);
        return vscode.Uri.file(loc);
    }
}

export class TestAssetWorkspace {
    constructor(workspace: ITestAssetWorkspace) {
        this.projects = workspace.projects.map((w) => new TestAssetProject(w));

        this.description = workspace.description;
    }

    get vsCodeDirectoryPath(): string {
        return path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, '.vscode');
    }

    get launchJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, 'launch.json');
    }

    get tasksJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, 'tasks.json');
    }

    async cleanupWorkspace(): Promise<void> {
        const workspaceRootPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const cleanUpRoutine = async () => {
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            await spawnGit(['clean', '-xdf', '.'], { cwd: workspaceRootPath });
            await spawnGit(['checkout', '--', '.'], { cwd: workspaceRootPath });
        };

        const sleep = async () => new Promise((resolve) => setTimeout(resolve, 2 * 1000));

        try {
            await cleanUpRoutine();
        } catch (error) {
            // Its possible that cleanup fails for locked files etc, for this reason retry is added.
            await sleep();
            await cleanUpRoutine();
        }
    }

    /**
     * Temporary workaround for lack of restore support in the roslyn server.
     * Replace when https://github.com/dotnet/vscode-csharp/issues/5725 is fixed.
     */
    async restoreLspToolsHostAsync(): Promise<void> {
        const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const output = await execChildProcess(`dotnet restore ${root}`, process.cwd(), process.env);
        console.log(output);
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
