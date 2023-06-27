/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'async-file';
import * as path from 'path';
import * as vscode from 'vscode';
import { EventStream } from '../../../src/eventStream';
import { EventType } from '../../../src/omnisharp/eventType';
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

    async restore(): Promise<void> {
        await vscode.commands.executeCommand('dotnet.restore.all');
    }

    async restoreAndWait(activation: ActivationResult): Promise<void> {
        await this.restore();

        // Wait for activity to settle before proceeding
        await this.waitForIdle(activation.eventStream);
    }

    async waitForEvent<T extends BaseEvent>(
        stream: EventStream,
        captureType: EventType,
        stopCondition: (e: T) => boolean = (_) => true,
        timeout: number = 25 * 1000
    ): Promise<T | undefined> {
        let event: T | undefined = undefined;

        const subscription = stream.subscribe((e: BaseEvent) => {
            if (e.type === captureType) {
                const tEvent = <T>e;

                if (stopCondition(tEvent)) {
                    event = tEvent;
                    subscription.unsubscribe();
                }
            }
        });

        await poll(
            () => event,
            timeout,
            500,
            (e) => !!e
        );

        return event;
    }

    async waitForIdle(stream: EventStream, timeout: number = 25 * 1000): Promise<void> {
        let event: BaseEvent | undefined = { type: 0 };

        const subscription = stream.subscribe(
            (e: BaseEvent) => e.type !== EventType.BackgroundDiagnosticStatus && (event = e)
        );
        await poll(
            () => event,
            timeout,
            500,
            (e) => {
                if (e) {
                    // We're still getting real events, set the event to undefined so we can check if it changed in the next poll.
                    event = undefined;
                    return false;
                } else {
                    // The event is still undefined (set by the last poll) which means we haven't recieved any new events - we can exit here.
                    return true;
                }
            }
        );

        subscription.unsubscribe();
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
