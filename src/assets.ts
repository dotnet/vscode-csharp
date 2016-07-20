/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as vscode from 'vscode';
import * as tasks from 'vscode-tasks';
import {OmnisharpServer} from './omnisharp/server';
import * as serverUtils from './omnisharp/utils';
import * as protocol from './omnisharp/protocol.ts'

interface DebugConfiguration {
    name: string,
    type: string,
    request: string,
    sourceFileMap?: any,
}

interface ConsoleLaunchConfiguration extends DebugConfiguration {
    preLaunchTask: string,
    program: string,
    args: string[],
    cwd: string,
    stopAtEntry: boolean,
    env?: any,
    externalConsole?: boolean
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
    processId: string
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

function computeProgramPath(projectData: TargetProjectData) {
    if (!projectData) {
        // If there's no target project data, use a placeholder for the path.
        return '${workspaceRoot}/bin/Debug/<target-framework>/<project-name.dll>'
    }

    let result = '${workspaceRoot}';
    
    if (projectData.projectPath) {
        result = path.join(result, path.relative(vscode.workspace.rootPath, projectData.projectPath.fsPath));
    }

    result = path.join(result, `bin/${projectData.configurationName}/${projectData.targetFramework}/${projectData.executableName}`);

    return result;
}

function createLaunchConfiguration(projectData: TargetProjectData): ConsoleLaunchConfiguration {
    return {
        name: '.NET Core Launch (console)',
        type: 'coreclr',
        request: 'launch',
        preLaunchTask: 'build',
        program: computeProgramPath(projectData),
        args: [],
        cwd: '${workspaceRoot}',
        externalConsole: false,
        stopAtEntry: false
    }
}

function createWebLaunchConfiguration(projectData: TargetProjectData): WebLaunchConfiguration {
    return {
        name: '.NET Core Launch (web)',
        type: 'coreclr',
        request: 'launch',
        preLaunchTask: 'build',
        program: computeProgramPath(projectData),
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
        },
        env: {
            ASPNETCORE_ENVIRONMENT: "Development"
        },
        sourceFileMap: {
            "/Views": "${workspaceRoot}/Views"
        }
    }
}

function createAttachConfiguration(): AttachConfiguration {
    return {
        name: '.NET Core Attach',
        type: 'coreclr',
        request: 'attach',
        processId: "${command.pickProcess}"
    }
}

function createLaunchJson(projectData: TargetProjectData, isWebProject: boolean): any {
    let version =  '0.2.0';
     if (!isWebProject) {
        return {
            version: version,
            configurations: [
                createLaunchConfiguration(projectData),
                createAttachConfiguration()
            ]
        }
    }
    else {
        return {
            version: version,
            configurations: [
                createWebLaunchConfiguration(projectData),
                createAttachConfiguration()
            ]
        }
    }
}

function createBuildTaskDescription(projectData: TargetProjectData): tasks.TaskDescription {
    let buildPath = '';
    if (projectData) {
        buildPath = path.join('${workspaceRoot}', path.relative(vscode.workspace.rootPath, projectData.projectJsonPath.fsPath));
    }

    return {
        taskName: 'build',
        args: [buildPath],
        isBuildCommand: true,
        problemMatcher: '$msCompile'
    };
}

function createTasksConfiguration(projectData: TargetProjectData): tasks.TaskConfiguration {
    return {
        version: '0.1.0',
        command: 'dotnet',
        isShellCommand: true,
        args: [],
        tasks: [ createBuildTaskDescription(projectData) ]
    };
}

function addTasksJsonIfNecessary(projectData: TargetProjectData, paths: Paths, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addTasksJson) {
            return resolve();
        }
        
        const tasksJson = createTasksConfiguration(projectData);
        const tasksJsonText = JSON.stringify(tasksJson, null, '    ');
        
        return fs.writeFileAsync(paths.tasksJsonPath, tasksJsonText);
    });
}

interface TargetProjectData {
    projectPath: vscode.Uri;
    projectJsonPath: vscode.Uri;
    targetFramework: string;
    executableName: string;
    configurationName: string;
}

function findTargetProjectData(projects: protocol.DotNetProject[]): TargetProjectData {
    // TODO: For now, assume the Debug configuration. Eventually, we'll need to revisit
    // this when we allow selecting configurations.
    const configurationName = 'Debug';

    const executableProjects = findExecutableProjects(projects, configurationName);

    // TODO: We arbitrarily pick the first executable projec that we find. This will need
    // revisiting when we project a "start up project" selector.
    const targetProject = executableProjects.length > 0
        ? executableProjects[0]
        : undefined;

    if (targetProject && targetProject.Frameworks.length > 0) {
        const config = targetProject.Configurations.find(c => c.Name === configurationName);
        if (config) {
            return {
                projectPath: targetProject.Path ? vscode.Uri.file(targetProject.Path) : undefined,
                projectJsonPath: vscode.Uri.file(path.join(targetProject.Path, 'project.json')),
                targetFramework: targetProject.Frameworks[0].ShortName,
                executableName: path.basename(config.CompilationOutputAssemblyFile),
                configurationName
            };
        }
    }

    return undefined;
}

function findExecutableProjects(projects: protocol.DotNetProject[], configName: string) {
    let result: protocol.DotNetProject[] = [];

    projects.forEach(project => {
        project.Configurations.forEach(configuration => {
            if (configuration.Name === configName && configuration.EmitEntryPoint === true) {
                if (project.Frameworks.length > 0) {
                    result.push(project);
                }
            }
        });
    });

    return result;
}

function hasWebServerDependency(targetProjectData: TargetProjectData): boolean {
    if (!targetProjectData || !targetProjectData.projectJsonPath) {
        return false;
    }

    let projectJson = fs.readFileSync(targetProjectData.projectJsonPath.fsPath, 'utf8');
    projectJson = projectJson.replace(/^\uFEFF/, '');

    let projectJsonObject: any;

    try {
        // TODO: This error should be surfaced to the user. If the JSON can't be parsed
        // (maybe due to a syntax error like an extra comma), the user should be notified
        // to fix up their project.json.
        projectJsonObject = JSON.parse(projectJson);
    } catch (error) {
        projectJsonObject = null;
    }

    if (projectJsonObject == null) {
        return false;
    }
    
    for (var key in projectJsonObject.dependencies) {
        if (key.toLowerCase().startsWith("microsoft.aspnetcore.server")) {
            return true;
        }
    }
    
    return false;
}

function addLaunchJsonIfNecessary(projectData: TargetProjectData, paths: Paths, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addLaunchJson) {
            return resolve();
        }

        const isWebProject = hasWebServerDependency(projectData);
        const launchJson = createLaunchJson(projectData, isWebProject);
        const launchJsonText = JSON.stringify(launchJson, null, '    ');
        
        return fs.writeFileAsync(paths.launchJsonPath, launchJsonText);
    });
}

export function addAssetsIfNecessary(server: OmnisharpServer) {
    if (!vscode.workspace.rootPath) {
        return;
    }
    
    return serverUtils.requestWorkspaceInformation(server).then(info => {
        // If there are no .NET Core projects, we won't bother offering to add assets.
        if ('DotNet' in info && info.DotNet.Projects.length > 0) {
            return getOperations().then(operations => {
                if (!hasOperations(operations)) {
                    return;
                }
                
                promptToAddAssets().then(addAssets => {
                    if (!addAssets) {
                        return;
                    }
                    
                    const data = findTargetProjectData(info.DotNet.Projects);
                    const paths = getPaths();
                    
                    return fs.ensureDirAsync(paths.vscodeFolder).then(() => {
                        return Promise.all([
                            addTasksJsonIfNecessary(data, paths, operations),
                            addLaunchJsonIfNecessary(data, paths, operations)
                        ]);
                    });
                });
            });
        }
    });
}