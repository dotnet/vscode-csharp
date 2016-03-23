/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as vscode from 'vscode';
import * as tasks from 'vscode-tasks';

interface DebugConfiguration {
    name: string,
    type: string,
    request: string,
}

interface ConsoleLaunchConfiguration extends DebugConfiguration {
    preLaunchTask: string,
    program: string,
    args: string[],
    cwd: string,
    stopAtEntry: boolean
}

interface CommandLine {
    command: string,
    args?: string
}

interface LaunchBrowserConfiguration {
    enabled: boolean,
    args: string,
    windows?: CommandLine,
    osx: CommandLine,
    linux: CommandLine
}

interface WebLaunchConfiguration extends ConsoleLaunchConfiguration {
    launchBrowser: LaunchBrowserConfiguration
}

interface AttachConfiguration extends DebugConfiguration {
    processName: string
}

interface Paths {
    vscodeFolder: string;
    tasksJsonPath: string;
    launchJsonPath: string;
}

function getPaths(): Paths {
    const vscodeFolder = path.join(vscode.workspace.rootPath, '.vscode');
    
    return {
        vscodeFolder: vscodeFolder,
        tasksJsonPath: path.join(vscodeFolder, 'tasks.json'),
        launchJsonPath: path.join(vscodeFolder, 'launch.json')
    }
}

interface Operations {
    addTasksJson?: boolean,
    updateTasksJson?: boolean,
    addLaunchJson?: boolean
}

function hasOperations(operations: Operations) {
    return operations.addLaunchJson ||
           operations.updateTasksJson ||
           operations.addLaunchJson;
}

function getOperations() {
    const paths = getPaths();

    return getBuildOperations(paths.tasksJsonPath).then(operations => 
           getLaunchOperations(paths.launchJsonPath, operations));
}

function getBuildOperations(tasksJsonPath: string) {
    return new Promise<Operations>((resolve, reject) => {
        return fs.existsAsync(tasksJsonPath).then(exists => {
            if (exists) {
                fs.readFileAsync(tasksJsonPath).then(buffer => {
                    const text = buffer.toString();
                    const tasksJson: tasks.TaskConfiguration = JSON.parse(text);
                    const buildTask = tasksJson.tasks.find(td => td.taskName === 'build');
                    
                    resolve({ updateTasksJson: (buildTask === undefined) });
                });
            }
            else {
                resolve({ addTasksJson: true });
            }
        });
    });
}

function getLaunchOperations(launchJsonPath: string, operations: Operations) {
    return new Promise<Operations>((resolve, reject) => {
        return fs.existsAsync(launchJsonPath).then(exists => {
            if (exists) {
                resolve(operations);
            }
            else {
                operations.addLaunchJson = true;
                resolve(operations);
            }
        });
    });
}

function promptToAddAssets() {
    return new Promise<boolean>((resolve, reject) => {
        const item = { title: 'Yes' }
        
        vscode.window.showInformationMessage('Required assets to build and debug are missing from your project. Add them?', item).then(selection => {
            return selection
                ? resolve(true)
                : resolve(false);
        });
    });
}

function createLaunchConfiguration(): ConsoleLaunchConfiguration {
    return {
        name: '.NET Core Launch (console)',
        type: 'coreclr',
        request: 'launch',
        preLaunchTask: 'build',
        program: '${workspaceRoot}/bin/Debug/<target-framework>/<project-name.dll>',
        args: [],
        cwd: '${workspaceRoot}',
        stopAtEntry: false
    }
}

function createWebLaunchConfiguration(): WebLaunchConfiguration {
    return {
        name: '.NET Core Launch (web)',
        type: 'coreclr',
        request: 'launch',
        preLaunchTask: 'build',
        program: '${workspaceRoot}/bin/Debug/<target-framework>/<project-name.dll>',
        args: [],
        cwd: '${workspaceRoot}',
        stopAtEntry: false,
        launchBrowser: {
            enabled: true,
            args: '${auto-detect-url}',
            windows: {
                command: 'cmd.exe',
                args: '/C start ${auto-detect-url}'
            },
            osx: {
                command: 'open'
            },
            linux: {
                command: 'xdg-open'
            }
        }
    }
}

function createAttachConfiguration(): AttachConfiguration {
    return {
        name: '.NET Core Attack',
        type: 'coreclr',
        request: 'attach',
        processName: '<example>'
    }
}

function createLaunchJson(): any {
    return {
        version: '0.2.0',
        configurations: [
            createLaunchConfiguration(),
            createWebLaunchConfiguration(),
            createAttachConfiguration()
        ]
    }
}

function createBuildTaskDescription(): tasks.TaskDescription {
    return {
        taskName: 'build',
        args: [],
        isBuildCommand: true,
        problemMatcher: '$msCompile'
    };
}

function createTasksConfiguration(): tasks.TaskConfiguration {
    return {
        version: '0.1.0',
        command: 'dotnet',
        isShellCommand: true,
        args: [],
        tasks: [ createBuildTaskDescription() ]
    };
}

function addTasksJsonIfNecessary(paths: Paths, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addTasksJson) {
            return resolve();
        }
        
        const tasksJson = createTasksConfiguration();
        const tasksJsonText = JSON.stringify(tasksJson, null, '    ');
        
        return fs.writeFileAsync(paths.tasksJsonPath, tasksJsonText);
    });
}

function updateTasksJsonIfNecesssary(paths: Paths, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.updateTasksJson) {
            return resolve();
        }
        
        return fs.readFileAsync(paths.tasksJsonPath).then(buffer => {
            const bufferText = buffer.toString();
            const tasksJson: tasks.TaskConfiguration = JSON.parse(bufferText);
            tasksJson.tasks.push(createBuildTaskDescription());
            const tasksJsonText = JSON.stringify(tasksJson, null, '    ');
            
            return fs.writeFileAsync(paths.tasksJsonPath, tasksJsonText);
        });
    });
}

function addLaunchJsonIfNecessary(paths: Paths, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addLaunchJson) {
            return resolve();
        }
        
        const launchJson = createLaunchJson();
        const launchJsonText = JSON.stringify(launchJson, null, '    ');
        
        return fs.writeFileAsync(paths.launchJsonPath, launchJsonText);
    });
}

export function addAssetsIfNecessary() {
    if (!vscode.workspace.rootPath) {
        return;
    }
    
    // If there is no project.json, we won't bother to prompt the user for tasks.json.
    const projectJsonPath = path.join(vscode.workspace.rootPath, 'project.json');
    if (!fs.existsSync(projectJsonPath)) {
        return;
    }
    
    return getOperations().then(operations => {
        if (!hasOperations(operations)) {
            return;
        }
        
        promptToAddAssets().then(addAssets => {
            if (!addAssets) {
                return;
            }
            
            const paths = getPaths();
            
            return fs.ensureDirAsync(paths.vscodeFolder).then(() => {
                return Promise.all([
                    addTasksJsonIfNecessary(paths, operations),
                    updateTasksJsonIfNecesssary(paths, operations),
                    addLaunchJsonIfNecessary(paths, operations)
                ]);
            });
        });
    });
}