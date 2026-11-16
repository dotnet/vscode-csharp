/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { existsSync, promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import spawnGit from './spawnGit';
import { execChildProcess } from '../../../../src/common';

export class TestAssetProject {
    private readonly addedFiles = new Set<string>();

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

        // Track newly added files so they can be cleaned up later.
        if (!existsSync(loc)) {
            this.addedFiles.add(loc);
        }

        await fs.writeFile(loc, contents);
        return vscode.Uri.file(loc);
    }

    async cleanupAddedFiles(): Promise<void> {
        for (const file of this.addedFiles) {
            await fs.rm(file, { force: true });
        }
        this.addedFiles.clear();
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

    private get isPreparedWorkspace(): boolean {
        const preparedWorkspace = process.env.ROSLYN_TEST_PREPARED_WORKSPACE;
        return (
            preparedWorkspace !== undefined &&
            path.relative(preparedWorkspace, vscode.workspace.workspaceFolders![0].uri.fsPath) === ''
        );
    }

    async cleanupWorkspace(mode: 'normal' | 'cold' = 'normal'): Promise<void> {
        const workspaceRootPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
        const cleanUpRoutine = async () => {
            // Revert any changes to tracked files and clean up added files to ensure a consistent workspace state.
            for (const document of vscode.workspace.textDocuments) {
                const relativePath = path.relative(workspaceRootPath, document.uri.fsPath);
                if (
                    document.isDirty &&
                    document.uri.scheme === 'file' &&
                    relativePath !== '..' &&
                    !relativePath.startsWith(`..${path.sep}`) &&
                    !path.isAbsolute(relativePath)
                ) {
                    await vscode.window.showTextDocument(document);
                    await vscode.commands.executeCommand('workbench.action.files.revert');
                    if (document.isDirty) {
                        throw new Error(`Failed to revert test fixture document: ${document.uri.fsPath}`);
                    }
                }
            }

            await vscode.commands.executeCommand('workbench.action.closeAllEditors');

            // Clean up any newly added files tracked by the projects.
            for (const project of this.projects) {
                await project.cleanupAddedFiles();
            }

            const cleanArgs = ['clean', '-xdf'];

            // Exclude each prepared project's bin/obj directories from normal cleanup to reuse restore/build outputs.
            // Cold cleanup omits these exclusions to force a fresh restore.
            if (mode === 'normal' && this.isPreparedWorkspace) {
                // Git's anchored exclusions are relative to the repository, not the fixture working directory.
                const { stdout: prefix } = await spawnGit(['rev-parse', '--show-prefix'], { cwd: workspaceRootPath });
                for (const project of this.projects) {
                    const projectDirectory = path.posix.dirname(project.relativeFilePath);
                    for (const outputDirectory of ['bin', 'obj']) {
                        cleanArgs.push(
                            '-e',
                            `/${path.posix.join(prefix.trimEnd(), projectDirectory, outputDirectory)}/`
                        );
                    }
                }
            }

            await spawnGit([...cleanArgs, '--', '.'], { cwd: workspaceRootPath });
            await spawnGit(['checkout', '--', '.'], { cwd: workspaceRootPath });
        };

        const sleep = async () => new Promise((resolve) => setTimeout(resolve, 2 * 1000));

        try {
            await cleanUpRoutine();
        } catch (error) {
            // Its possible that cleanup fails for locked files etc, for this reason retry is added.
            console.warn('Workspace cleanup failed; retrying in two seconds.', error);
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
        // The task prepares the workspace before launch. Check the outputs as cold cleanup invalidates them.
        if (
            this.isPreparedWorkspace &&
            this.projects.every((project) =>
                existsSync(path.join(project.projectDirectoryPath, 'obj', 'project.assets.json'))
            )
        ) {
            console.log('Reusing restored test workspace build outputs.');
            return;
        }

        const output = await execChildProcess(`dotnet restore "${root}"`, process.cwd(), process.env);
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
