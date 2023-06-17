/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import { IWorkspaceDebugInformationProvider, ProjectDebugInformation } from './IWorkspaceDebugInformationProvider';
import { AssetGenerator, AssetOperations, addTasksJsonIfNecessary, getBuildOperations } from './assets';
import { getServiceBroker } from '../lsptoolshost/services/brokeredServicesHosting';
import Descriptors from '../lsptoolshost/services/Descriptors';
import { DotnetDebugConfigurationServiceErrorKind, IDotnetDebugConfigurationService, IDotnetDebugConfigurationServiceResult } from '../lsptoolshost/services/IDotnetDebugConfigurationService';

// User errors that can be shown to the user.
class LaunchServiceError extends Error {}
// Suppresses a debug session from starting
class StopDebugLaunchServiceError extends Error {
    constructor() {
        super();
    }
}
// Errors due to parts of the service not implemented. TODO Remove these?
class InternalServiceError extends Error {}
// The error that is thrown if we are unable to get services through getProxy.
class UnavaliableLaunchServiceError extends Error {}

const workspaceFolderToken = "${workspaceFolder}";
/**
 * Replaces '${workspaceFolder}' with the current folder while keeping path separators consistent.
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
        if (debugConfiguration.type === undefined) {
            return debugConfiguration;
        }

        if (debugConfiguration.request !== "launch") {
            throw new Error(`'${debugConfiguration.request}' is unsupported.`);
        }

        let projectPath: string = debugConfiguration.projectPath;
        if (folder && projectPath)
        {
            projectPath = resolveWorkspaceFolderToken(projectPath, folder.uri.fsPath);

            const dotnetDebugServiceProxy = await getServiceBroker()?.getProxy<IDotnetDebugConfigurationService>(Descriptors.dotnetDebugConfigurationService);
            try {
                if (dotnetDebugServiceProxy) {
                    const result: IDotnetDebugConfigurationServiceResult = await dotnetDebugServiceProxy.resolveDebugConfigurationWithLaunchConfigurationService(projectPath, debugConfiguration, token);
                    return this.resolveDotnetDebugConfigurationServiceResult(projectPath, result);
                } else {
                    throw new UnavaliableLaunchServiceError();
                }
            }
            catch (e) {
                if (e instanceof UnavaliableLaunchServiceError) {
                    return await this.resolveDebugConfigurationWithWorkspaceDebugInformationProvider(folder, projectPath);
                } else if (e instanceof StopDebugLaunchServiceError) {
                    return undefined;
                } else {
                    throw e;
                }
            }
            finally {
                dotnetDebugServiceProxy?.dispose();
            }
        }

        return debugConfiguration;
    }

    //#endregion

    private resolveDotnetDebugConfigurationServiceResult(projectPath: string, result: IDotnetDebugConfigurationServiceResult): vscode.DebugConfiguration {
        if (result.error) {
            const errorResult = result.error;
            switch (errorResult.kind) {
                case DotnetDebugConfigurationServiceErrorKind.launchCancelled:
                    throw new StopDebugLaunchServiceError();
                case DotnetDebugConfigurationServiceErrorKind.internalError:
                case DotnetDebugConfigurationServiceErrorKind.userError:
                    throw new LaunchServiceError(errorResult.message);
                default:
                    throw new InternalServiceError(`Unexpected error kind: '${errorResult.kind}'`);
            }
        }

        const debugConfigArray = result.configurations;
        if (debugConfigArray.length == 0) {
            throw new LaunchServiceError(`No launchable target found for '${projectPath}'`);
        } if (debugConfigArray.length == 1) {
            return debugConfigArray[0];
        } else if (debugConfigArray.length > 1) {
            throw new InternalServiceError("Multiple launch targets is not yet supported.");
        } else {
            throw new InternalServiceError("Unexpected configuration array from IDotnetDebugConfigurationServiceResult.");
        }
    }

    /**
     * Calls into the workspaceDebugInfoProvider to get launch configurations. It will ignore the attach configurations.
     *
     * @param folder The workspace folder for which the configurations are used. Required for 'dotnet' debug configuration resolution.
     * @param projectPath The expected path to the .csproj
     * @returns
     */
    private async resolveDebugConfigurationWithWorkspaceDebugInformationProvider(folder: vscode.WorkspaceFolder, projectPath: string): Promise<vscode.DebugConfiguration> {
        const info: ProjectDebugInformation[] | undefined = await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
        if (!info) {
            throw new Error("Cannot resolve .NET debug configurations. The server is still initializing or has exited unexpectedly.");
        }

        for (let index = 0; index < info.length; index++) {
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