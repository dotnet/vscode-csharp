/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as vscode from 'vscode';
import spawnGit from './spawnGit';
import { dotnetRestore } from '../../../src/features/commands';
import { EventStream } from '../../../src/EventStream';

export class TestAssetProject {
    constructor(project: ITestAssetProject) {
        this.relativeFilePath = project.relativeFilePath;
    }

    relativeFilePath: string;

    get projectDirectoryPath(): string {
        return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath,
            path.dirname(this.relativeFilePath));
    }

    get binDirectoryPath(): string {
        return path.join(this.projectDirectoryPath, 'bin');
    }

    get objDirectoryPath(): string {
        return path.join(this.projectDirectoryPath, 'obj');
    }

    async deleteBuildArtifacts(): Promise<void> {
        await fs.rimraf(this.binDirectoryPath);
        await fs.rimraf(this.objDirectoryPath);
    }

    async restore(): Promise<void> {
        await dotnetRestore(this.projectDirectoryPath, new EventStream());
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

    async deleteBuildArtifacts(): Promise<void> {
        this.projects.forEach(async p => await p.deleteBuildArtifacts());
    }

    async restore(): Promise<void> {
        this.projects.forEach(async p => await p.restore());
    }

    get vsCodeDirectoryPath(): string {
        return path.join(vscode.workspace.rootPath, ".vscode");
    }

    get launchJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, "launch.json");
    }

    get tasksJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, "tasks.json");
    }

    async cleanupWorkspace(): Promise<void> {
        let cleanUpRoutine = async () =>
        {
            for (let project of this.projects) {
                let wd = project.projectDirectoryPath;
                await spawnGit(["clean", "-xdf", "."], { cwd: wd });
                await spawnGit(["checkout", "--", "."], { cwd: wd });
            }
        };

        let sleep = () => new Promise((resolve) => setTimeout(resolve, 2*1000));

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