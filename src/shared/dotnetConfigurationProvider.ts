/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import { IWorkspaceDebugInformationProvider, ProjectDebugInformation } from './IWorkspaceDebugInformationProvider';
import { AssetGenerator, AssetOperations, addTasksJsonIfNecessary, getBuildOperations } from './assets';
import { getServiceBroker } from '../lsptoolshost/services/brokeredServicesHosting';
import Descriptors from '../lsptoolshost/services/descriptors';
import {
    DotnetDebugConfigurationServiceErrorKind,
    IDotnetDebugConfigurationService,
    IDotnetDebugConfigurationServiceResult,
} from '../lsptoolshost/services/IDotnetDebugConfigurationService';
import { DotnetWorkspaceConfigurationProvider } from './workspaceConfigurationProvider';

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

const workspaceFolderToken = '${workspaceFolder}';
/**
 * Replaces '${workspaceFolder}' with the current folder while keeping path separators consistent.
 *
 * @param projectPath The expected path to the .csproj
 * @param folderPath The current workspace folder
 * @returns A fully resolved path to the .csproj
 */
function resolveWorkspaceFolderToken(projectPath: string, folderPath: string): string {
    if (projectPath.startsWith(workspaceFolderToken)) {
        const relativeProjectPath: string = projectPath.substring(workspaceFolderToken.length);

        // Keep the path seperate consistant
        if (relativeProjectPath.startsWith('/')) {
            folderPath = folderPath.replace(/[\\/]+/g, '/');
        } else {
            folderPath = folderPath.replace(/[\\/]+/g, '\\');
        }

        projectPath = folderPath + relativeProjectPath;
    }

    return projectPath;
}

export class DotnetConfigurationResolver implements vscode.DebugConfigurationProvider {
    static dotnetType = 'dotnet';

    constructor(
        private workspaceDebugInfoProvider: IWorkspaceDebugInformationProvider,
        private dotnetWorkspaceConfigurationProvider: DotnetWorkspaceConfigurationProvider
    ) {}

    //#region vscode.DebugConfigurationProvider

    async resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        debugConfiguration: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | undefined> {
        /** This {@link vscode.DebugConfigurationProvider} does not handle Run and Debug */
        if (debugConfiguration.type === undefined) {
            return debugConfiguration;
        }

        if (debugConfiguration.request !== 'launch') {
            if (!debugConfiguration.request) {
                throw new Error(vscode.l10n.t("'{0}' was not set in the debug configuration.", 'request'));
            } else {
                throw new Error(
                    vscode.l10n.t(
                        "'{0}' request is not supported for the '{1}' configuration.",
                        debugConfiguration.request,
                        DotnetConfigurationResolver.dotnetType
                    )
                );
            }
        }

        let projectPath: string | undefined = debugConfiguration.projectPath;
        if (folder) {
            if (projectPath) {
                projectPath = resolveWorkspaceFolderToken(projectPath, folder.uri.fsPath);
            }

            const dotnetDebugServiceProxy = await getServiceBroker()?.getProxy<IDotnetDebugConfigurationService>(
                Descriptors.dotnetDebugConfigurationService
            );
            try {
                if (dotnetDebugServiceProxy) {
                    const result: IDotnetDebugConfigurationServiceResult =
                        await dotnetDebugServiceProxy.resolveDebugConfigurationWithLaunchConfigurationService(
                            projectPath,
                            debugConfiguration,
                            token
                        );
                    return this.resolveDotnetDebugConfigurationServiceResult(projectPath, result);
                } else {
                    throw new UnavaliableLaunchServiceError();
                }
            } catch (e) {
                if (e instanceof UnavaliableLaunchServiceError) {
                    if (!projectPath) {
                        throw new LaunchServiceError(
                            vscode.l10n.t("'{0}' was not provided in the debug configuration.", 'projectPath')
                        );
                    }

                    return await this.resolveDebugConfigurationWithWorkspaceDebugInformationProvider(
                        folder,
                        projectPath
                    );
                } else if (e instanceof StopDebugLaunchServiceError) {
                    return undefined;
                } else {
                    throw e;
                }
            } finally {
                dotnetDebugServiceProxy?.dispose();
            }
        } else {
            throw new Error(
                vscode.l10n.t(
                    "Can not find an opened workspace folder. Please open a folder before starting to debug with a '{0}' configuration'.",
                    DotnetConfigurationResolver.dotnetType
                )
            );
        }
    }

    //#endregion

    private resolveDotnetDebugConfigurationServiceResult(
        projectPath: string | undefined,
        result: IDotnetDebugConfigurationServiceResult
    ): vscode.DebugConfiguration {
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
            if (!projectPath) {
                throw new LaunchServiceError(vscode.l10n.t('No launchable target found.'));
            } else {
                throw new LaunchServiceError(vscode.l10n.t("No launchable target found for '{0}'", projectPath));
            }
        }
        if (debugConfigArray.length == 1) {
            return debugConfigArray[0];
        } else if (debugConfigArray.length === 2) {
            // This creates a onDidStartDebugSession event listener that will dispose of itself when it detects
            // the debugConfiguration that is return from this method has started.
            const startDebugEvent = vscode.debug.onDidStartDebugSession(async (debugSession: vscode.DebugSession) => {
                if (debugSession.name === debugConfigArray[0].name) {
                    startDebugEvent.dispose();
                    await vscode.debug.startDebugging(debugSession.workspaceFolder, debugConfigArray[1], debugSession);
                }
            });

            return debugConfigArray[0];
        } else if (debugConfigArray.length > 2) {
            throw new InternalServiceError('Multiple launch targets (>2) is not yet supported.');
        } else {
            throw new InternalServiceError(
                'Unexpected configuration array from IDotnetDebugConfigurationServiceResult.'
            );
        }
    }

    /**
     * Calls into the workspaceDebugInfoProvider to get launch configurations. It will ignore the attach configurations.
     *
     * @param folder The workspace folder for which the configurations are used. Required for 'dotnet' debug configuration resolution.
     * @param projectPath The expected path to the .csproj
     * @returns
     */
    private async resolveDebugConfigurationWithWorkspaceDebugInformationProvider(
        folder: vscode.WorkspaceFolder,
        projectPath: string
    ): Promise<vscode.DebugConfiguration> {
        const info: ProjectDebugInformation[] | undefined =
            await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
        if (!info) {
            throw new Error(
                vscode.l10n.t(
                    'Cannot resolve .NET debug configurations. The server is still initializing or has exited unexpectedly.'
                )
            );
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
                    const generatedDebugConfigurations: vscode.DebugConfiguration[] =
                        generator.createLaunchJsonConfigurationsArray(programLaunchType, true);

                    if (generatedDebugConfigurations.length === 1) {
                        const result = generatedDebugConfigurations[0];
                        // TODO: Pass through the launch configuration id if ILaunchConfigurationService names them the same or parse and return the actual one.
                        return result;
                    } else {
                        throw new Error(
                            vscode.l10n.t(
                                `Unable to determine a configuration for '{0}'. Please generate C# debug assets instead.`,
                                projectPath
                            )
                        );
                    }
                } else {
                    throw new Error(vscode.l10n.t("'{0}' is not an executable project.", projectPath));
                }
            }
        }
        throw new Error(vscode.l10n.t("Unable to determine debug settings for project '{0}'", projectPath));
    }

    // Workaround for VS Code not calling into the 'coreclr' resolveDebugConfigurationWithSubstitutedVariables
    async resolveDebugConfigurationWithSubstitutedVariables(
        folder: vscode.WorkspaceFolder | undefined,
        debugConfiguration: vscode.DebugConfiguration,
        token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration | null | undefined> {
        return this.dotnetWorkspaceConfigurationProvider.resolveDebugConfigurationWithSubstitutedVariables(
            folder,
            debugConfiguration,
            token
        );
    }
}
