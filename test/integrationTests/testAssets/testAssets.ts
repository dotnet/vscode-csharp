/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as vscode from 'vscode';

export class TestAssetProject {
    constructor(project: ITestAssetProject) {
        this.relativePath = project.relativePath;
    }

    relativePath: string;

    get projectDirectoryPath(): string {
        return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath,
            this.relativePath);
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

    async addFileWithContents(fileName: string, contents: string): Promise<vscode.Uri> {
        let loc = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, fileName);
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

    get vsCodeDirectoryPath(): string {
        return path.join(vscode.workspace.rootPath, ".vscode");
    }

    get launchJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, "launch.json");
    }

    get tasksJsonPath(): string {
        return path.join(this.vsCodeDirectoryPath, "tasks.json");
    }

    description: string;

    projects: TestAssetProject[];
}

export interface ITestAssetProject {
    relativePath: string;
}

export interface ITestAssetWorkspace {
    description: string;
    projects: ITestAssetProject[];
}