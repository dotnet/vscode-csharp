/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as vscode from 'vscode';
import { EventStream } from '../../../src/EventStream';
import { EventType } from '../../../src/omnisharp/EventType';
import { BaseEvent } from '../../../src/omnisharp/loggingEvents';
import { ActivationResult } from '../integrationHelpers';
import { poll } from '../poll';
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

    async restoreAndWait(activation: ActivationResult): Promise<void> {
        await this.restore();

        // Wait for activity to settle before proceeding
        await this.waitForIdle(activation.eventStream);
    }

    async waitForEvent<T extends BaseEvent>(stream: EventStream, captureType: EventType, stopCondition: (e: T) => boolean = _ => true, timeout: number = 25 * 1000): Promise<T> {
        let event: T = null;

        const subscription = stream.subscribe((e: BaseEvent) => {
            if (e.type === captureType) {
                const tEvent = <T>e;

                if (stopCondition(tEvent)) {
                    event = tEvent;
                    subscription.unsubscribe();
                }
            }
        });

        await poll(() => event, timeout, 500, e => !!e);

        return event;
    }

    async waitForIdle(stream: EventStream, timeout: number = 25 * 1000): Promise<void> {
        let event: BaseEvent = { type: 0 };

        const subscription = stream.subscribe((e: BaseEvent) => e.type !== EventType.ProjectDiagnosticStatus && (event = e));

        await poll(() => event, timeout, 500, e => !e || (event = null));

        subscription.unsubscribe();
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