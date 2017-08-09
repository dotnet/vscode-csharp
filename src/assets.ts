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
import { tolerantParse } from './json';
import * as util from './common';

export class AssetGenerator {
    public rootPath: string;
    public vscodeFolder: string;
    public tasksJsonPath: string;
    public launchJsonPath: string;

    private hasProject: boolean;
    private projectPath: string;
    private projectFilePath: string;
    private targetFramework: string;
    private executableName: string;
    private configurationName: string;

    public constructor(workspaceInfo: protocol.WorkspaceInformationResponse, rootPath: string = vscode.workspace.rootPath) {
        if (rootPath === null || rootPath === undefined) {
            throw new Error('rootPath must set.');
        }

        this.rootPath = rootPath;
        this.vscodeFolder = path.join(this.rootPath, '.vscode');
        this.tasksJsonPath = path.join(this.vscodeFolder, 'tasks.json');
        this.launchJsonPath = path.join(this.vscodeFolder, 'launch.json');

        this.initializeProjectData(workspaceInfo);
    }

    private initializeProjectData(workspaceInfo: protocol.WorkspaceInformationResponse) {
        // TODO: For now, assume the Debug configuration. Eventually, we'll need to revisit
        // this when we allow selecting configurations.
        const configurationName = 'Debug';

        // First, we'll check for .NET Core .csproj projects.
        if (workspaceInfo.MsBuild && workspaceInfo.MsBuild.Projects) {
            const executableMSBuildProjects = findExecutableMSBuildProjects(workspaceInfo.MsBuild.Projects);

            const targetMSBuildProject = executableMSBuildProjects.length > 0
                ? executableMSBuildProjects[0]
                : undefined;

            if (targetMSBuildProject) {
                this.hasProject = true;
                this.projectPath = path.dirname(targetMSBuildProject.Path);
                this.projectFilePath = targetMSBuildProject.Path;
                this.targetFramework = protocol.findNetCoreAppTargetFramework(targetMSBuildProject).ShortName;
                this.executableName = targetMSBuildProject.AssemblyName + ".dll";
                this.configurationName = configurationName;
                return;
            }
        }

        // Next, we'll try looking for project.json projects.
        const executableProjects = findExecutableProjectJsonProjects(workspaceInfo.DotNet.Projects, configurationName);

        // TODO: We arbitrarily pick the first executable project that we find. This will need
        // revisiting when we project a "start up project" selector.
        const targetProject = executableProjects.length > 0
            ? executableProjects[0]
            : undefined;

        if (targetProject && targetProject.Frameworks.length > 0) {
            const config = targetProject.Configurations.find(c => c.Name === configurationName);
            if (config) {
                this.hasProject = true;
                this.projectPath = targetProject.Path;
                this.projectFilePath = path.join(targetProject.Path, 'project.json');
                this.targetFramework = targetProject.Frameworks[0].ShortName;
                this.executableName = path.basename(config.CompilationOutputAssemblyFile);
                this.configurationName = configurationName;
            }
        }

        return undefined;
    }

    public hasWebServerDependency(): boolean {
        // TODO: Update to handle .NET Core projects.

        if (!this.projectFilePath) {
            return false;
        }

        let projectFileText = fs.readFileSync(this.projectFilePath, 'utf8');

        if (path.basename(this.projectFilePath).toLowerCase() === 'project.json') {
            let projectJsonObject: any;

            try {
                projectJsonObject = tolerantParse(projectFileText);
            }
            catch (error) {
                vscode.window.showErrorMessage('Failed to parse project.json file');
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
        }

        // Assume that this is an MSBuild project. In that case, look for the 'Sdk="Microsoft.NET.Sdk.Web"' attribute.
        // TODO: Have OmniSharp provide the list of SDKs used by a project and check that list instead.
        return projectFileText.toLowerCase().indexOf('sdk="microsoft.net.sdk.web"') >= 0;
    }

    private computeProgramPath() {
        if (!this.hasProject) {
            // If there's no target project data, use a placeholder for the path.
            return '${workspaceRoot}/bin/Debug/<insert-target-framework-here>/<insert-project-name-here>.dll';
        }

        let result = '${workspaceRoot}';

        if (this.projectPath) {
            result = path.join(result, path.relative(this.rootPath, this.projectPath));
        }

        result = path.join(result, `bin/${this.configurationName}/${this.targetFramework}/${this.executableName}`);

        return result;
    }

    private computeWorkingDirectory() : string {
        if (!this.hasProject) {
            // If there's no target project data, use a placeholder for the path.
            return '${workspaceRoot}';
        }

        let result = '${workspaceRoot}';

        if (this.projectPath) {
            result = path.join(result, path.relative(this.rootPath, this.projectPath));
        }

        return result;
    }

    private createLaunchConfiguration(): string{
        return `
{
    "name": ".NET Core Launch (console)",
    "type": "coreclr",
    "request": "launch",
    "preLaunchTask": "build",
    // If you have changed target frameworks, make sure to update the program path.
    "program": "${util.convertNativePathToPosix(this.computeProgramPath())}",
    "args": [],
    "cwd": "${util.convertNativePathToPosix(this.computeWorkingDirectory())}",
    // For more information about the 'console' field, see https://github.com/OmniSharp/omnisharp-vscode/blob/master/debugger-launchjson.md#console-terminal-window
    "console": "internalConsole",
    "stopAtEntry": false,
    "internalConsoleOptions": "openOnSessionStart"
}`;
    }

    private createWebLaunchConfiguration(): string {
        return `
{
    "name": ".NET Core Launch (web)",
    "type": "coreclr",
    "request": "launch",
    "preLaunchTask": "build",
    // If you have changed target frameworks, make sure to update the program path.
    "program": "${util.convertNativePathToPosix(this.computeProgramPath())}",
    "args": [],
    "cwd": "${util.convertNativePathToPosix(this.computeWorkingDirectory())}",
    "stopAtEntry": false,
    "internalConsoleOptions": "openOnSessionStart",
    "launchBrowser": {
        "enabled": true,
        "args": "\${auto-detect-url}",
        "windows": {
            "command": "cmd.exe",
            "args": "/C start \${auto-detect-url}"
        },
        "osx": {
            "command": "open"
        },
        "linux": {
            "command": "xdg-open"
        }
    },
    "env": {
        "ASPNETCORE_ENVIRONMENT": "Development"
    },
    "sourceFileMap": {
        "/Views": "\${workspaceRoot}/Views"
    }
}`;
    }

    // AttachConfiguration
    private createAttachConfiguration(): string {
        return `
{
    "name": ".NET Core Attach",
    "type": "coreclr",
    "request": "attach",
    "processId": "\${command:pickProcess}"
}`;
    }

    public createLaunchJson(isWebProject: boolean): string {
        if (!isWebProject) {
            const launchConfigurationsMassaged: string = indentJsonString(this.createLaunchConfiguration());
            const attachConfigurationsMassaged: string = indentJsonString(this.createAttachConfiguration());
            return `
[
    ${launchConfigurationsMassaged},
    ${attachConfigurationsMassaged}
]`;
        }
        else {
            const webLaunchConfigurationsMassaged: string = indentJsonString(this.createWebLaunchConfiguration());
            const attachConfigurationsMassaged: string = indentJsonString(this.createAttachConfiguration());
            return `
[
    ${webLaunchConfigurationsMassaged},
    ${attachConfigurationsMassaged}
]`;
        }
    }

    private createBuildTaskDescription(): tasks.TaskDescription {
        let buildPath = '';
        if (this.hasProject) {
            buildPath = path.join('${workspaceRoot}', path.relative(this.rootPath, this.projectFilePath));
        }

        return {
            taskName: 'build',
            args: [util.convertNativePathToPosix(buildPath)],
            isBuildCommand: true,
            problemMatcher: '$msCompile'
        };
    }

    public createTasksConfiguration(): tasks.TaskConfiguration {
        return {
            version: '0.1.0',
            command: 'dotnet',
            isShellCommand: true,
            args: [],
            tasks: [this.createBuildTaskDescription()]
        };
    }
}

function findExecutableMSBuildProjects(projects: protocol.MSBuildProject[]) {
    let result: protocol.MSBuildProject[] = [];

    projects.forEach(project => {
        if (project.IsExe && protocol.findNetCoreAppTargetFramework(project) !== undefined) {
            result.push(project);
        }
    });

    return result;
}

function findExecutableProjectJsonProjects(projects: protocol.DotNetProject[], configurationName: string) {
    let result: protocol.DotNetProject[] = [];

    projects.forEach(project => {
        project.Configurations.forEach(configuration => {
            if (configuration.Name === configurationName && configuration.EmitEntryPoint === true) {
                if (project.Frameworks.length > 0) {
                    result.push(project);
                }
            }
        });
    });

    return result;
}

function containsDotNetCoreProjects(workspaceInfo: protocol.WorkspaceInformationResponse) {
    if (workspaceInfo.DotNet && findExecutableProjectJsonProjects(workspaceInfo.DotNet.Projects, 'Debug').length > 0) {
        return true;
    }

    if (workspaceInfo.MsBuild && findExecutableMSBuildProjects(workspaceInfo.MsBuild.Projects).length > 0) {
        return true;
    }

    return false;
}


interface Operations {
    addTasksJson?: boolean;
    updateTasksJson?: boolean;
    addLaunchJson?: boolean;
}

function hasAddOperations(operations: Operations) {
    return operations.addLaunchJson || operations.addLaunchJson;
}

function getOperations(generator: AssetGenerator) {
    return getBuildOperations(generator.tasksJsonPath).then(operations =>
        getLaunchOperations(generator.launchJsonPath, operations));
}

function getBuildTasks(tasksConfiguration: tasks.TaskConfiguration): tasks.TaskDescription[] {
    let result: tasks.TaskDescription[] = [];

    function findBuildTask(tasksDescriptions: tasks.TaskDescription[]) {
        if (tasksDescriptions) {
            const buildTask = tasksDescriptions.find(td => td.isBuildCommand);
            if (buildTask !== undefined) {
                result.push(buildTask);
            }
        }
    }

    findBuildTask(tasksConfiguration.tasks);

    if (tasksConfiguration.windows) {
        findBuildTask(tasksConfiguration.windows.tasks);
    }

    if (tasksConfiguration.osx) {
        findBuildTask(tasksConfiguration.osx.tasks);
    }

    if (tasksConfiguration.linux) {
        findBuildTask(tasksConfiguration.linux.tasks);
    }

    return result;
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
                    let tasksConfiguration: tasks.TaskConfiguration;

                    try {
                        tasksConfiguration = tolerantParse(text);
                    }
                    catch (error) {
                        vscode.window.showErrorMessage(`Failed to parse tasks.json file`);
                        return resolve({ updateTasksJson: false });
                    }

                    let buildTasks = getBuildTasks(tasksConfiguration);

                    resolve({ updateTasksJson: buildTasks.length === 0 });
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

function addTasksJsonIfNecessary(generator: AssetGenerator, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addTasksJson) {
            return resolve();
        }

        const tasksJson = generator.createTasksConfiguration();
        const tasksJsonText = JSON.stringify(tasksJson, null, '    ');

        fs.writeFile(generator.tasksJsonPath, tasksJsonText, err => {
            if (err) {
                return reject(err);
            }

            resolve();
        });
    });
}

function indentJsonString(json: string, numSpaces: number = 4): string {
    return json.split('\n').map(line => ' '.repeat(numSpaces) + line).join('\n').trim();
}

function addLaunchJsonIfNecessary(generator: AssetGenerator, operations: Operations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addLaunchJson) {
            return resolve();
        }

        const isWebProject = generator.hasWebServerDependency();
        const launchJson: string = generator.createLaunchJson(isWebProject);

        const configurationsMassaged: string = indentJsonString(launchJson);

        const launchJsonText = `
{
   // Use IntelliSense to find out which attributes exist for C# debugging
   // Use hover for the description of the existing attributes
   // For further information visit https://github.com/OmniSharp/omnisharp-vscode/blob/master/debugger-launchjson.md
   "version": "0.2.0",
   "configurations": ${configurationsMassaged}
}`;

        fs.writeFile(generator.launchJsonPath, launchJsonText.trim(), err => {
            if (err) {
                return reject(err);
            }

            resolve();
        });
    });
}

function addAssets(generator: AssetGenerator, operations: Operations) {
    const promises = [
        addTasksJsonIfNecessary(generator, operations),
        addLaunchJsonIfNecessary(generator, operations)
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
            if (containsDotNetCoreProjects(info)) {
                const generator = new AssetGenerator(info);
                return getOperations(generator).then(operations => {
                    if (!hasAddOperations(operations)) {
                        return resolve(AddAssetResult.NotApplicable);
                    }

                    promptToAddAssets().then(result => {
                        if (result === PromptResult.Disable) {
                            return resolve(AddAssetResult.Disable);
                        }

                        if (result !== PromptResult.Yes) {
                            return resolve(AddAssetResult.Cancelled);
                        }

                        fs.ensureDir(generator.vscodeFolder, err => {
                            addAssets(generator, operations).then(() =>
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

function deleteAssets(generator: AssetGenerator) {
    return Promise.all([
        util.deleteIfExists(generator.launchJsonPath),
        util.deleteIfExists(generator.tasksJsonPath)
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
        if (containsDotNetCoreProjects(info)) {
            const generator = new AssetGenerator(info);
            getOperations(generator).then(operations => {
                if (hasAddOperations(operations)) {
                    shouldGenerateAssets(generator).then(res => {
                        if (res) {
                            fs.ensureDir(generator.vscodeFolder, err => {
                                addAssets(generator, operations);
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
