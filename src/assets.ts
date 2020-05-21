/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import * as protocol from './omnisharp/protocol';
import * as serverUtils from './omnisharp/utils';
import * as tasks from 'vscode-tasks';
import * as util from './common';
import * as vscode from 'vscode';

import { OmniSharpServer } from './omnisharp/server';
import { tolerantParse } from './json';

export class AssetGenerator {
    public workspaceFolder: vscode.WorkspaceFolder;
    public vscodeFolder: string;
    public tasksJsonPath: string;
    public launchJsonPath: string;

    private executeableProjects: protocol.MSBuildProject[];
    private startupProject: protocol.MSBuildProject | undefined;
    private fallbackBuildProject: protocol.MSBuildProject;

    public constructor(workspaceInfo: protocol.WorkspaceInformationResponse, workspaceFolder: vscode.WorkspaceFolder = undefined) {
        if (workspaceFolder) {
            this.workspaceFolder = workspaceFolder;
        }
        else {
            let resourcePath: string = undefined;

            if (!resourcePath && workspaceInfo.Cake) {
                resourcePath = workspaceInfo.Cake.Path;
            }

            if (!resourcePath && workspaceInfo.ScriptCs) {
                resourcePath = workspaceInfo.ScriptCs.Path;
            }

            if (!resourcePath && workspaceInfo.DotNet && workspaceInfo.DotNet.Projects.length > 0) {
                resourcePath = workspaceInfo.DotNet.Projects[0].Path;
            }

            if (!resourcePath && workspaceInfo.MsBuild) {
                resourcePath = workspaceInfo.MsBuild.SolutionPath;
            }

            this.workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(resourcePath));
        }

        this.vscodeFolder = path.join(this.workspaceFolder.uri.fsPath, '.vscode');
        this.tasksJsonPath = path.join(this.vscodeFolder, 'tasks.json');
        this.launchJsonPath = path.join(this.vscodeFolder, 'launch.json');

        this.startupProject = undefined;
        this.fallbackBuildProject = undefined;

        if (workspaceInfo.MsBuild && workspaceInfo.MsBuild.Projects.length > 0) {
            this.executeableProjects = protocol.findExecutableMSBuildProjects(workspaceInfo.MsBuild.Projects);
            if (this.executeableProjects.length === 0) {
                this.fallbackBuildProject = workspaceInfo.MsBuild.Projects[0];
            }
        } else {
            this.executeableProjects = [];
        }
    }

    public hasExecutableProjects(): boolean {
        return this.executeableProjects.length > 0;
    }

    public isStartupProjectSelected(): boolean {
        if (this.startupProject) {
            return true;
        } else {
            return false;
        }
    }

    public async selectStartupProject(selectedIndex?: number): Promise<boolean> {
        if (!this.hasExecutableProjects()) {
            throw new Error("No executable projects");
        }

        if (this.executeableProjects.length === 1) {
            this.startupProject = this.executeableProjects[0];
            return true;
        } else {
            const mapItemNameToProject: { [key: string]: protocol.MSBuildProject } = {};
            const itemNames: string[] = [];

            this.executeableProjects.forEach(project => {
                const itemName = `${path.basename(project.Path, ".csproj")} (${project.Path})`;
                itemNames.push(itemName);
                mapItemNameToProject[itemName] = project;
            });

            let selectedItem: string;
            if (selectedIndex != null) {
                selectedItem = itemNames[selectedIndex];
            }
            else {
                selectedItem = await vscode.window.showQuickPick(itemNames, {
                    matchOnDescription: true,
                    placeHolder: "Select the project to launch"
                });
            }
            if (!selectedItem || !mapItemNameToProject[selectedItem]) {
                return false;
            }

            this.startupProject = mapItemNameToProject[selectedItem];
            return true;
        }
    }

    // This method is used by the unit tests instead of selectStartupProject
    public setStartupProject(index: number): void {
        if (index >= this.executeableProjects.length) {
            throw new Error("Invalid project index");
        }

        this.startupProject = this.executeableProjects[index];
    }

    public hasWebServerDependency(): boolean {
        if (!this.startupProject) {
            throw new Error("Startup project not set");
        }

        return this.startupProject.IsWebProject;
    }

    public computeProgramLaunchType(): ProgramLaunchType {
        if (!this.startupProject) {
            throw new Error("Startup project not set");
        }

        if (this.startupProject.IsBlazorWebAssemblyStandalone) {
            return ProgramLaunchType.BlazorWebAssemblyStandalone;
        }

        if (this.startupProject.IsBlazorWebAssemblyHosted) {
            return ProgramLaunchType.BlazorWebAssemblyHosted;
        }

        if (this.startupProject.IsWebProject) {
            return ProgramLaunchType.Web;
        }

        return ProgramLaunchType.Console;
    }

    private computeProgramPath() {
        if (!this.startupProject) {
            throw new Error("Startup project not set");
        }

        const startupProjectDir = path.dirname(this.startupProject.Path);
        const relativeProjectDir = path.join('${workspaceFolder}', path.relative(this.workspaceFolder.uri.fsPath, startupProjectDir));
        const configurationName = 'Debug';
        const targetFramework = protocol.findNetCoreAppTargetFramework(this.startupProject) ?? protocol.findNet5TargetFramework(this.startupProject);
        const result = path.join(relativeProjectDir, `bin/${configurationName}/${targetFramework.ShortName}/${this.startupProject.AssemblyName}.dll`);
        return result;
    }

    private computeWorkingDirectory(): string {
        if (!this.startupProject) {
            throw new Error("Startup project not set");
        }

        const startupProjectDir = path.dirname(this.startupProject.Path);

        return path.join('${workspaceFolder}', path.relative(this.workspaceFolder.uri.fsPath, startupProjectDir));
    }

    public createLaunchJsonConfigurations(programLaunchType: ProgramLaunchType): string {
        switch (programLaunchType) {
            case ProgramLaunchType.Console: {
                const launchConfigurationsMassaged: string = indentJsonString(createLaunchConfiguration(this.computeProgramPath(), this.computeWorkingDirectory()));
                const attachConfigurationsMassaged: string = indentJsonString(createAttachConfiguration());
                return `
[
    ${launchConfigurationsMassaged},
    ${attachConfigurationsMassaged}
]`;
            }
            case ProgramLaunchType.Web: {
                const webLaunchConfigurationsMassaged: string = indentJsonString(createWebLaunchConfiguration(this.computeProgramPath(), this.computeWorkingDirectory()));
                const attachConfigurationsMassaged: string = indentJsonString(createAttachConfiguration());
                return `
[
    ${webLaunchConfigurationsMassaged},
    ${attachConfigurationsMassaged}
]`;
            }
            case ProgramLaunchType.BlazorWebAssemblyHosted: {
                const hostedLaunchConfigMassaged: string = indentJsonString(createBlazorWebAssemblyHostedLaunchConfiguration(this.computeProgramPath(), this.computeWorkingDirectory()));
                return `
[
    ${hostedLaunchConfigMassaged}
]`;
            }
            case ProgramLaunchType.BlazorWebAssemblyStandalone: {
                const standaloneLaunchConfigMassaged: string = indentJsonString(createBlazorWebAssemblyStandaloneLaunchConfiguration(this.computeWorkingDirectory()));
                return `
[
    ${standaloneLaunchConfigMassaged}
]`;
            }
        }
    }

    private createBuildTaskDescription(): tasks.TaskDescription {
        let commandArgs = ['build'];

        this.AddAdditionalCommandArgs(commandArgs);

        return {
            label: 'build',
            command: 'dotnet',
            type: 'process',
            args: commandArgs,
            problemMatcher: '$msCompile'
        };
    }


    private createPublishTaskDescription(): tasks.TaskDescription {
        let commandArgs = ['publish'];

        this.AddAdditionalCommandArgs(commandArgs);

        return {
            label: 'publish',
            command: 'dotnet',
            type: 'process',
            args: commandArgs,
            problemMatcher: '$msCompile'
        };
    }

    private createWatchTaskDescription(): tasks.TaskDescription {
        let commandArgs = ['watch', 'run'];

        this.AddAdditionalCommandArgs(commandArgs);

        return {
            label: 'watch',
            command: 'dotnet',
            type: 'process',
            args: commandArgs,
            problemMatcher: '$msCompile'
        };
    }

    private AddAdditionalCommandArgs(commandArgs: string[]) {
        let buildProject = this.startupProject;
        if (!buildProject) {
            buildProject = this.fallbackBuildProject;
        }
        if (buildProject) {
            const buildPath = path.join('${workspaceFolder}', path.relative(this.workspaceFolder.uri.fsPath, buildProject.Path));
            commandArgs.push(util.convertNativePathToPosix(buildPath));
        }

        commandArgs.push("/property:GenerateFullPaths=true");
        commandArgs.push("/consoleloggerparameters:NoSummary");
    }

    public createTasksConfiguration(): tasks.TaskConfiguration {
        return {
            version: "2.0.0",
            tasks: [this.createBuildTaskDescription(), this.createPublishTaskDescription(), this.createWatchTaskDescription()]
        };
    }
}

export enum ProgramLaunchType {
    Console,
    Web,
    BlazorWebAssemblyHosted,
    BlazorWebAssemblyStandalone,
}

export function createWebLaunchConfiguration(programPath: string, workingDirectory: string): string {
    return `
{
    "name": ".NET Core Launch (web)",
    "type": "coreclr",
    "request": "launch",
    "preLaunchTask": "build",
    // If you have changed target frameworks, make sure to update the program path.
    "program": "${util.convertNativePathToPosix(programPath)}",
    "args": [],
    "cwd": "${util.convertNativePathToPosix(workingDirectory)}",
    "stopAtEntry": false,
    // Enable launching a web browser when ASP.NET Core starts. For more information: https://aka.ms/VSCode-CS-LaunchJson-WebBrowser
    "serverReadyAction": {
        "action": "openExternally",
        "pattern": "^\\\\s*Now listening on:\\\\s+(https?://\\\\S+)"
    },
    "env": {
        "ASPNETCORE_ENVIRONMENT": "Development"
    },
    "sourceFileMap": {
        "/Views": "\${workspaceFolder}/Views"
    }
}`;
}

export function createBlazorWebAssemblyHostedLaunchConfiguration(programPath: string, workingDirectory: string): string {
    return `
{
    "name": "Launch and Debug Hosted Blazor WebAssembly App",
    "type": "blazorwasm",
    "request": "launch",
    "hosted": true,
    // If you have changed target frameworks, make sure to update the program path.
    "program": "${util.convertNativePathToPosix(programPath)}",
    "cwd": "${util.convertNativePathToPosix(workingDirectory)}"
}`;
}

export function createBlazorWebAssemblyStandaloneLaunchConfiguration(workingDirectory: string): string {
    return `
{
    "name": "Launch and Debug Standalone Blazor WebAssembly App",
    "type": "blazorwasm",
    "request": "launch",
    "cwd": "${util.convertNativePathToPosix(workingDirectory)}"
}`;
}

export function createLaunchConfiguration(programPath: string, workingDirectory: string): string {
    return `
{
    "name": ".NET Core Launch (console)",
    "type": "coreclr",
    "request": "launch",
    "preLaunchTask": "build",
    // If you have changed target frameworks, make sure to update the program path.
    "program": "${util.convertNativePathToPosix(programPath)}",
    "args": [],
    "cwd": "${util.convertNativePathToPosix(workingDirectory)}",
    // For more information about the 'console' field, see https://aka.ms/VSCode-CS-LaunchJson-Console
    "console": "internalConsole",
    "stopAtEntry": false
}`;
}

// DebugConfiguration written to launch.json when the extension fails to generate a good configuration
export function createFallbackLaunchConfiguration(): vscode.DebugConfiguration {
    return {
        "name": ".NET Core Launch (console)",
        "type": "coreclr",
        "request": "launch",
        "WARNING01": "*********************************************************************************",
        "WARNING02": "The C# extension was unable to automatically decode projects in the current",
        "WARNING03": "workspace to create a runnable launch.json file. A template launch.json file has",
        "WARNING04": "been created as a placeholder.",
        "WARNING05": "",
        "WARNING06": "If OmniSharp is currently unable to load your project, you can attempt to resolve",
        "WARNING07": "this by restoring any missing project dependencies (example: run 'dotnet restore')",
        "WARNING08": "and by fixing any reported errors from building the projects in your workspace.",
        "WARNING09": "If this allows OmniSharp to now load your project then --",
        "WARNING10": "  * Delete this file",
        "WARNING11": "  * Open the Visual Studio Code command palette (View->Command Palette)",
        "WARNING12": "  * run the command: '.NET: Generate Assets for Build and Debug'.",
        "WARNING13": "",
        "WARNING14": "If your project requires a more complex launch configuration, you may wish to delete",
        "WARNING15": "this configuration and pick a different template using the 'Add Configuration...'",
        "WARNING16": "button at the bottom of this file.",
        "WARNING17": "*********************************************************************************",
        "preLaunchTask": "build",
        "program": "${workspaceFolder}/bin/Debug/<insert-target-framework-here>/<insert-project-name-here>.dll",
        "args": [],
        "cwd": "${workspaceFolder}",
        "console": "internalConsole",
        "stopAtEntry": false
    };
}

// AttachConfiguration
export function createAttachConfiguration(): string {
    return `
{
    "name": ".NET Core Attach",
    "type": "coreclr",
    "request": "attach",
    "processId": "\${command:pickProcess}"
}`;
}

export interface AssetOperations {
    addTasksJson?: boolean;
    updateTasksJson?: boolean;
    addLaunchJson?: boolean;
}

function hasAddOperations(operations: AssetOperations) {
    return operations.addTasksJson || operations.addLaunchJson;
}

async function getOperations(generator: AssetGenerator): Promise<AssetOperations> {
    return getBuildOperations(generator).then(async operations =>
        getLaunchOperations(generator, operations));
}

/**
 * Finds a build task if there is one. Only handles new format.
 */
function getBuildTasks(tasksConfiguration: tasks.TaskConfiguration): tasks.TaskDescription[] {
    let result: tasks.TaskDescription[] = [];

    function findBuildTask(version: string, tasksDescriptions: tasks.TaskDescription[]) {
        let buildTask = undefined;
        if (tasksDescriptions) {
            buildTask = tasksDescriptions.find(td => td.group === 'build');
        }

        if (buildTask !== undefined) {
            result.push(buildTask);
        }
    }

    findBuildTask(tasksConfiguration.version, tasksConfiguration.tasks);

    if (tasksConfiguration.windows) {
        findBuildTask(tasksConfiguration.version, tasksConfiguration.windows.tasks);
    }

    if (tasksConfiguration.osx) {
        findBuildTask(tasksConfiguration.version, tasksConfiguration.osx.tasks);
    }

    if (tasksConfiguration.linux) {
        findBuildTask(tasksConfiguration.version, tasksConfiguration.linux.tasks);
    }

    return result;
}

export async function getBuildOperations(generator: AssetGenerator): Promise<AssetOperations> {
    return new Promise<AssetOperations>((resolve, reject) => {
        fs.exists(generator.tasksJsonPath, exists => {
            if (exists) {
                fs.readFile(generator.tasksJsonPath, (err, buffer) => {
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

                    if (!tasksConfiguration.version || !tasksConfiguration.version.startsWith("2.0.")) {
                        // We don't have code to update the older tasks format, so don't try to update it
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

async function getLaunchOperations(generator: AssetGenerator, operations: AssetOperations): Promise<AssetOperations> {

    if (!generator.hasExecutableProjects()) {
        return Promise.resolve(operations);
    }

    return new Promise<AssetOperations>((resolve, reject) => {
        return fs.exists(generator.launchJsonPath, exists => {
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

async function promptToAddAssets(workspaceFolder: vscode.WorkspaceFolder) {
    return new Promise<PromptResult>((resolve, reject) => {
        const yesItem: PromptItem = { title: 'Yes', result: PromptResult.Yes };
        const noItem: PromptItem = { title: 'Not Now', result: PromptResult.No, isCloseAffordance: true };
        const disableItem: PromptItem = { title: "Don't Ask Again", result: PromptResult.Disable };

        const projectName = path.basename(workspaceFolder.uri.fsPath);

        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        if (!csharpConfig.get<boolean>('supressBuildAssetsNotification')) {
            vscode.window.showWarningMessage(
                `Required assets to build and debug are missing from '${projectName}'. Add them?`, disableItem, noItem, yesItem)
                .then(selection => resolve(selection?.result ?? PromptResult.No));
        }
    });
}

export async function addTasksJsonIfNecessary(generator: AssetGenerator, operations: AssetOperations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addTasksJson && !operations.updateTasksJson) {
            return resolve();
        }

        const tasksJson = generator.createTasksConfiguration();

        // NOTE: We only want to do this when we are supposed to update the task configuration. Otherwise,
        // in the case of the 'generateAssets' command, even though we already deleted the tasks.json file
        // this will still return the old tasks.json content
        if (operations.updateTasksJson) {
            const tasksConfigs = vscode.workspace.getConfiguration('tasks');
            let existingTaskConfigs = tasksConfigs.get<Array<tasks.TaskDescription>>('tasks');

            if (existingTaskConfigs) {
                tasksJson['tasks'] = tasksJson['tasks'].concat(existingTaskConfigs);
            }
        }

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

async function addLaunchJsonIfNecessary(generator: AssetGenerator, operations: AssetOperations) {
    return new Promise<void>((resolve, reject) => {
        if (!operations.addLaunchJson) {
            return resolve();
        }

        // NOTE: We will NOT attempt to merge in the existing launch.json configurations
        // because in the startup prompt case, we will not attempt to create a launch.json if it
        // already exists, and in the command case, we delete the launch.json file, but the VS
        // Code API will return old configurations anyway, which we do NOT want.

        const programLaunchType = generator.computeProgramLaunchType();
        const launchJsonConfigurations: string = generator.createLaunchJsonConfigurations(programLaunchType);
        const configurationsMassaged: string = indentJsonString(launchJsonConfigurations);

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

async function addAssets(generator: AssetGenerator, operations: AssetOperations) {

    if (generator.hasExecutableProjects() && !generator.isStartupProjectSelected()) {
        if (!await generator.selectStartupProject()) {
            return;
        }
    }

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

export async function addAssetsIfNecessary(server: OmniSharpServer): Promise<AddAssetResult> {
    return new Promise<AddAssetResult>((resolve, reject) => {
        if (!vscode.workspace.workspaceFolders) {
            return resolve(AddAssetResult.NotApplicable);
        }

        serverUtils.requestWorkspaceInformation(server).then(async info => {
            const generator = new AssetGenerator(info);
            // If there aren't executable projects, we will not prompt
            if (generator.hasExecutableProjects()) {
                return getOperations(generator).then(operations => {
                    if (!hasAddOperations(operations)) {
                        return resolve(AddAssetResult.NotApplicable);
                    }

                    promptToAddAssets(generator.workspaceFolder).then(result => {
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

async function doesAnyAssetExist(generator: AssetGenerator) {
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

async function deleteAssets(generator: AssetGenerator) {
    return Promise.all([
        util.deleteIfExists(generator.launchJsonPath),
        util.deleteIfExists(generator.tasksJsonPath)
    ]);
}

async function shouldGenerateAssets(generator: AssetGenerator): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        doesAnyAssetExist(generator).then(res => {
            if (res) {
                const yesItem = { title: 'Yes' };
                const cancelItem = { title: 'Cancel', isCloseAffordance: true };
                vscode.window.showWarningMessage('Replace existing build and debug assets?', cancelItem, yesItem)
                    .then(selection => {
                        if (selection === yesItem) {
                            resolve(true);
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

export async function generateAssets(server: OmniSharpServer, selectedIndex?: number): Promise<void> {
    try {
        let workspaceInformation = await serverUtils.requestWorkspaceInformation(server);
        if (workspaceInformation.MsBuild && workspaceInformation.MsBuild.Projects.length > 0) {
            const generator = new AssetGenerator(workspaceInformation);
            let doGenerateAssets = await shouldGenerateAssets(generator);
            if (!doGenerateAssets) {
                return; // user cancelled
            }

            const operations: AssetOperations = {
                addLaunchJson: generator.hasExecutableProjects(),
                addTasksJson: true
            };
            if (operations.addLaunchJson) {
                if (!await generator.selectStartupProject(selectedIndex)) {
                    return; // user cancelled
                }
            }

            await deleteAssets(generator);
            await fs.ensureDir(generator.vscodeFolder);
            await addAssets(generator, operations);
        }
        else {
            await vscode.window.showErrorMessage("Could not locate .NET Core project. Assets were not generated.");
        }
    }
    catch (err) {
        await vscode.window.showErrorMessage(`Unable to generate assets to build and debug. ${err}`);
    }
}
