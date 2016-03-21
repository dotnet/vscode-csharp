/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as vscode from 'vscode';
import * as tasks from 'vscode-tasks';

function promptToAddBuildTask() {
    return new Promise<boolean>((resolve, reject) => {
        const item = { title: 'Yes' }
        
        vscode.window.showInformationMessage('Would you like to add a build task for your project?', item).then(selection => {
            return selection
                ? resolve(true)
                : resolve(false);
        });
    });
}

function createBuildTaskDescription(): tasks.TaskDescription {
    return {
        taskName: "build",
        args: [],
        isBuildCommand: true,
        problemMatcher: "$msCompile"
    };
}

function createTasksConfiguration(): tasks.TaskConfiguration {
    return {
        version: "0.1.0",
        command: "dotnet",
        isShellCommand: true,
        args: [],
        tasks: [ createBuildTaskDescription() ]
    };
}

function writeTasksJson(tasksJsonPath: string, tasksConfig: tasks.TaskConfiguration) {
    const tasksJsonText = JSON.stringify(tasksConfig, null, '    ');
    fs.writeFileSync(tasksJsonPath, tasksJsonText);
}

export function promptToAddBuildTaskIfNecessary() {
    if (!vscode.workspace.rootPath) {
        return;
    }
    
    // If there is no project.json, we won't bother to prompt the user for tasks.json.
    const projectJsonPath = path.join(vscode.workspace.rootPath, 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
        return;
    }

    const vscodeFolder = path.join(vscode.workspace.rootPath, '.vscode');
    const tasksJsonPath = path.join(vscodeFolder, 'tasks.json');
    
    fs.ensureDirAsync(vscodeFolder).then(() => {
        fs.existsAsync(tasksJsonPath).then(exists => {
            if (exists) {
                fs.readFileAsync(tasksJsonPath).then(text => {
                    const fileText = text.toString();
                    let tasksConfig: tasks.TaskConfiguration = JSON.parse(fileText);
                    let buildTask = tasksConfig.tasks.find(td => td.taskName === 'build');
                    if (!buildTask) {
                        promptToAddBuildTask().then(shouldAdd => {
                            buildTask = createBuildTaskDescription();
                            tasksConfig.tasks.push(buildTask);
                            writeTasksJson(tasksJsonPath, tasksConfig);
                        });
                    }
                });
            }
            else {
                promptToAddBuildTask().then(shouldAdd => {
                    const tasksConfig = createTasksConfiguration();
                    writeTasksJson(tasksJsonPath, tasksConfig);
                });
            }
        });
    });
}