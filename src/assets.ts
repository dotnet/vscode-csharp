/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import * as tasks from 'vscode-tasks';
import { OmniSharpServer } from './omnisharp/server';
import * as serverUtils from './omnisharp/utils';
import * as protocol from './omnisharp/protocol';

interface DebugConfiguration {
    name: string;
    type: string;
    request: string;
    internalConsoleOptions?: string;
    sourceFileMap?: any;
}

interface ConsoleLaunchConfiguration extends DebugConfiguration {
    preLaunchTask: string;
    program: string;
    args: string[];
    cwd: string;
    stopAtEntry: boolean;
    env?: any;
    externalConsole?: boolean;
}

interface CommandLine {
    command: string;
    args?: string;
}

interface LaunchBrowserConfiguration {
    enabled: boolean;
    args: string;
    windows?: CommandLine;
    osx: CommandLine;
    linux: CommandLine;
}

interface WebLaunchConfiguration extends ConsoleLaunchConfiguration {
    launchBrowser: LaunchBrowserConfiguration;
}

interface AttachConfiguration extends DebugConfiguration {
    processId: string;
}

export class AssetGenerator {
    public rootPath: string;
    public vscodeFolder: string;
    public tasksJsonPath: string;
    public launchJsonPath: string;

    public constructor(rootPath: string = vscode.workspace.rootPath) {
        if (rootPath === null || rootPath === undefined) {
            throw new Error('rootPath must set.');
        }

        this.rootPath = rootPath;
        this.vscodeFolder = path.join(this.rootPath, '.vscode');
        this.tasksJsonPath = path.join(this.vscodeFolder, 'tasks.json');
        this.launchJsonPath = path.join(this.vscodeFolder, 'launch.json');
    }

    private computeProgramPath(projectData: TargetProjectData) {
        if (!projectData) {
            // If there's no target project data, use a placeholder for the path.
            return '${workspaceRoot}/bin/Debug/<target-framework>/<project-name.dll>';
        }

        let result = '${workspaceRoot}';

        if (projectData.projectPath) {
            result = path.join(result, path.relative(this.rootPath, projectData.projectPath.fsPath));
        }

        result = path.join(result, `bin/${projectData.configurationName}/${projectData.targetFramework}/${projectData.executableName}`);

        return result;
    }

    private createLaunchConfiguration(projectData: TargetProjectData): ConsoleLaunchConfiguration {
        return {
            name: '.NET Core Launch (console)',
            type: 'coreclr',
            request: 'launch',
            preLaunchTask: 'build',
            program: this.computeProgramPath(projectData),
            args: [],
            cwd: '${workspaceRoot}',
            externalConsole: false,
            stopAtEntry: false,
            internalConsoleOptions: "openOnSessionStart"
        };
    }

    private createWebLaunchConfiguration(projectData: TargetProjectData): WebLaunchConfiguration {
        return {
            name: '.NET Core Launch (web)',
            type: 'coreclr',
            request: 'launch',
            preLaunchTask: 'build',
            program: this.computeProgramPath(projectData),
            args: [],
            cwd: '${workspaceRoot}',
            stopAtEntry: false,
            internalConsoleOptions: "openOnSessionStart",
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
        };
    }

    private createAttachConfiguration(): AttachConfiguration {
        return {
            name: '.NET Core Attach',
            type: 'coreclr',
            request: 'attach',
            processId: "${command.pickProcess}"
        };
    }

    public createLaunchJson(projectData: TargetProjectData, isWebProject: boolean): any {
        let version = '0.2.0';
        if (!isWebProject) {
            return {
                version: version,
                configurations: [
                    this.createLaunchConfiguration(projectData),
                    this.createAttachConfiguration()
                ]
            };
        }
        else {
            return {
                version: version,
                configurations: [
                    this.createWebLaunchConfiguration(projectData),
                    this.createAttachConfiguration()
                ]
            };
        }
    }

    private createBuildTaskDescription(projectData: TargetProjectData): tasks.TaskDescription {
        let buildPath = '';
        if (projectData) {
            buildPath = path.join('${workspaceRoot}', path.relative(this.rootPath, projectData.projectJsonPath.fsPath));
        }

        return {
            taskName: 'build',
            args: [buildPath],
            isBuildCommand: true,
            problemMatcher: '$msCompile'
        };
    }

    public createTasksConfiguration(projectData: TargetProjectData): tasks.TaskConfiguration {
        return {
            version: '0.1.0',
            command: 'dotnet',
            isShellCommand: true,
            args: [],
            tasks: [this.createBuildTaskDescription(projectData)]
        };
    }
}

interface Operations {
    addTasksJson?: boolean;
    updateTasksJson?: boolean;
    addLaunchJson?: boolean;
}

function hasOperations(operations: Operations) {
    return operations.addLaunchJson ||
        operations.updateTasksJson ||
        operations.addLaunchJson;
}

function getOperations(generator: AssetGenerator) {
    return getBuildOperations(generator.tasksJsonPath).then(operations =>
        getLaunchOperations(generator.launchJsonPath, operations));
}

function getBuildOperations(tasksJsonPath: string) {
    return new Promise<Operations>((resolve, reject) => {
        fs.exists(tasksJsonPath, exists => {
            if (exists) {
                fs.readFile(tasksJsonPath, (err, buffer) => {
                    if (err) {
                        return reject(err);
                    }

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
        return fs.exists(launchJsonPath, exists => {
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

enum PromptResult {
    Yes,
    No,
    Disable
}

interface PromptItem extends vscode.MessageItem {
    result: PromptResult;
}

function promptToAddAssets() {
    return new Promise<PromptResult>((resolve, reject) => {
        const yesItem: PromptItem = { title: 'Yes', result: PromptResult.Yes };
        const noItem: PromptItem = { title: 'Not Now', result: PromptResult.No, isCloseAffordance: true };
        const disableItem: PromptItem = { title: "Don't Ask Again", result: PromptResult.Disable };

        const projectName = path.basename(vscode.workspace.rootPath);

        vscode.window.showWarningMessage(
            `Required assets to build and debug are missing from '${projectName}'. Add them?`, disableItem, noItem, yesItem)
            .then(selection => resolve(selection.result));
    });
}

function addTasksJsonIfNecessary(projectData: TargetProjectData, generator: AssetGenerator, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addTasksJson) {
            return resolve();
        }

        const tasksJson = generator.createTasksConfiguration(projectData);
        const tasksJsonText = JSON.stringify(tasksJson, null, '    ');

        fs.writeFile(generator.tasksJsonPath, tasksJsonText, err => {
            if (err) {
                return reject(err);
            }

            resolve();
        });
    });
}

export interface TargetProjectData {
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

    for (let key in projectJsonObject.dependencies) {
        if (key.toLowerCase().startsWith("microsoft.aspnetcore.server")) {
            return true;
        }
    }

    return false;
}

function addLaunchJsonIfNecessary(projectData: TargetProjectData, generator: AssetGenerator, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addLaunchJson) {
            return resolve();
        }

        const isWebProject = hasWebServerDependency(projectData);
        const launchJson = generator.createLaunchJson(projectData, isWebProject);
        const launchJsonText = JSON.stringify(launchJson, null, '    ');

        fs.writeFile(generator.launchJsonPath, launchJsonText, err => {
            if (err) {
                return reject(err);
            }

            resolve();
        });
    });
}

function addAssets(data: TargetProjectData, generator: AssetGenerator, operations: Operations) {
    const promises = [
        addTasksJsonIfNecessary(data, generator, operations),
        addLaunchJsonIfNecessary(data, generator, operations)
    ];

    return Promise.all(promises);
}

export enum AddAssetResult {
    NotApplicable,
    Done,
    Disable,
    Cancelled
}

export function addAssetsIfNecessary(server: OmniSharpServer): Promise<AddAssetResult> {
    return new Promise<AddAssetResult>((resolve, reject) => {
        if (!vscode.workspace.rootPath) {
            return resolve(AddAssetResult.NotApplicable);
        }

        serverUtils.requestWorkspaceInformation(server).then(info => {
            // If there are no .NET Core projects, we won't bother offering to add assets.
            if (info.DotNet && info.DotNet.Projects.length > 0) {
                const generator = new AssetGenerator();
                return getOperations(generator).then(operations => {
                    if (!hasOperations(operations)) {
                        return resolve(AddAssetResult.NotApplicable);
                    }

                    promptToAddAssets().then(result => {
                        if (result === PromptResult.Disable) {
                            return resolve(AddAssetResult.Disable);
                        }

                        if (result !== PromptResult.Yes) {
                            return resolve(AddAssetResult.Cancelled);
                        }

                        const data = findTargetProjectData(info.DotNet.Projects);

                        fs.ensureDir(generator.vscodeFolder, err => {
                            addAssets(data, generator, operations).then(() =>
                                resolve(AddAssetResult.Done));
                        });
                    });
                });
            }
        }).catch(err =>
            reject(err));
    });
}

function doesAnyAssetExist(generator: AssetGenerator) {
    return new Promise<boolean>((resolve, reject) => {
        fs.exists(generator.launchJsonPath, exists => {
            if (exists) {
                resolve(true);
            }
            else {
                fs.exists(generator.tasksJsonPath, exists => {
                    resolve(exists);
                });
            }
        });
    });
}

function deleteAsset(path: string) {
    return new Promise<void>((resolve, reject) => {
        fs.exists(path, exists => {
            if (exists) {
                // TODO: Should we check after unlinking to see if the file still exists?
                fs.unlink(path, err => {
                    if (err) {
                        return reject(err);
                    }

                    resolve();
                });
            }
        });
    });
}

function deleteAssets(generator: AssetGenerator) {
    return Promise.all([
        deleteAsset(generator.launchJsonPath),
        deleteAsset(generator.tasksJsonPath)
    ]);
}

function shouldGenerateAssets(generator: AssetGenerator) {
    return new Promise<boolean>((resolve, reject) => {
        doesAnyAssetExist(generator).then(res => {
            if (res) {
                const yesItem = { title: 'Yes' };
                const cancelItem = { title: 'Cancel', isCloseAffordance: true };

                vscode.window.showWarningMessage('Replace existing build and debug assets?', cancelItem, yesItem)
                    .then(selection => {
                        if (selection === yesItem) {
                            deleteAssets(generator).then(_ => resolve(true));
                        }
                        else {
                            // The user clicked cancel
                            resolve(false);
                        }
                    });
            }
            else {
                // The assets don't exist, so we're good to go.
                resolve(true);
            }
        });

    });
}

export function generateAssets(server: OmniSharpServer) {
    serverUtils.requestWorkspaceInformation(server).then(info => {
        if (info.DotNet && info.DotNet.Projects.length > 0) {
            const generator = new AssetGenerator();
            getOperations(generator).then(operations => {
                if (hasOperations(operations)) {
                    shouldGenerateAssets(generator).then(res => {
                        if (res) {
                            fs.ensureDir(generator.vscodeFolder, err => {
                                const data = findTargetProjectData(info.DotNet.Projects);
                                addAssets(data, generator, operations);
                            });
                        }
                    });
                }
            });
        }
        else {
            vscode.window.showErrorMessage("Could not locate .NET Core project. Assets were not generated.");
        }
    });
}