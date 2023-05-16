/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import { IWorkspaceDebugInformationProvider, ProjectDebugInformation } from './IWorkspaceDebugInformationProvider';
import { AssetGenerator, AssetOperations, addTasksJsonIfNecessary, getBuildOperations } from './assets';

const workspaceFolderToken: string = "${workspaceFolder}";
/**
 * Replaces '${workspaceFolder}' with the current folder while keeping path seperators consistant.
 * 
 * @param projectPath The expected path to the .csproj
 * @param folderPath The current workspace folder
 * @returns A fully resolved path to the .csproj
 */
function resolveWorkspaceFolderToken(projectPath: string, folderPath: string): string
{
    if (projectPath.startsWith(workspaceFolderToken))
    {
        const relativeProjectPath: string = projectPath.substring(workspaceFolderToken.length);

        // Keep the path seperate consistant
        if (relativeProjectPath.startsWith('/'))
        {
            folderPath = folderPath.replace(/[\\/]+/g, '/');
        } 
        else
        {
            folderPath = folderPath.replace(/[\\/]+/g, '\\');
        }

        projectPath = folderPath + relativeProjectPath;
    }

    return projectPath;
}

export class DotnetConfigurationResolver implements vscode.DebugConfigurationProvider {
    constructor(private workspaceDebugInfoProvider: IWorkspaceDebugInformationProvider) {}

    //#region vscode.DebugConfigurationProvider

    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
        /** This {@link vscode.DebugConfigurationProvider} does not handle Run and Debug */
        if (Object.keys(debugConfiguration).length == 0) {
            return debugConfiguration;
        }

        let projectPath: string = debugConfiguration.projectPath;
        if (folder && projectPath)
        {
            projectPath = resolveWorkspaceFolderToken(projectPath, folder.uri.fsPath);

            try {
                throw new Error("Unable to acquire ILaunchConfigurationService."); // TODO: Acquire ILaunchConfigurationService
            }
            catch (e) {
                return await this.resolveDebugConfigurationWithWorkspaceDebugInformationProvider(folder, projectPath);
            }
        }

        return debugConfiguration;
    }

    //#endregion

    /**
     * Calls into the workspaceDebugInfoProvider to get launch configurations. It will ignore the attach configurations.
     * 
     * @param folder The workspace folder for which the configurations are used. Required for 'dotnet' debug configuration resolution.
     * @param projectPath The expected path to the .csproj
     * @returns 
     */
    private async resolveDebugConfigurationWithWorkspaceDebugInformationProvider(folder: vscode.WorkspaceFolder, projectPath: string): Promise<vscode.DebugConfiguration> {
        let info: ProjectDebugInformation[] | undefined = await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
        if (!info) {
            throw new Error("Cannot resolve .NET debug configurations. The server is still initializing or has exited unexpectedly.");
        }

        for (let index: number = 0; index < info.length; index++) {
            const normalizedInfoProjectPath = info[index].projectPath.replace(/[\\/]+/g, '/');
            const normalizedProjectPath = projectPath.replace(/[\\/]+/g, '/');

            if (normalizedProjectPath == normalizedInfoProjectPath) {
                const generator = new AssetGenerator(info, folder);
                if (generator.hasExecutableProjects()) {
                    await generator.selectStartupProject(index);

                    // Make sure .vscode folder exists, addTasksJsonIfNecessary will fail to create tasks.json if the folder does not exist.
                    await fs.ensureDir(generator.vscodeFolder);

                    // Add a tasks.json
                    const buildOperations: AssetOperations = await getBuildOperations(generator);
                    await addTasksJsonIfNecessary(generator, buildOperations);

                    const programLaunchType = generator.computeProgramLaunchType();
                    const generatedDebugConfigurations: vscode.DebugConfiguration[] = generator.createLaunchJsonConfigurationsArray(programLaunchType, true);

                    if (generatedDebugConfigurations.length === 1) {
                        const result = generatedDebugConfigurations[0];
                        // TODO: Pass through the launch configuration id if ILaunchConfigurationService names them the same or parse and return the actual one.
                        return result;
                    } else {
                        throw new Error(`Unable to determine a configuration for '${projectPath}'. Please generate C# debug assets instead.`);
                    }
                } else {
                    throw new Error(`'${projectPath}' is not an executable project.`);
                }
            }
        }
        throw new Error(`Unable to determine debug settings for project '${projectPath}'`);
    }
}