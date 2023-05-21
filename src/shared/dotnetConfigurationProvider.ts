/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import { IWorkspaceDebugInformationProvider, ProjectDebugInformation } from './IWorkspaceDebugInformationProvider';
import { AssetGenerator, AssetOperations, addTasksJsonIfNecessary, getBuildOperations } from './assets';
import { getServiceBroker } from '../lsptoolshost/services/brokeredServicesHosting';
import { BrowserLaunchTarget, CustomLaunchTarget, ErrorLaunchTarget, ExeLaunchTarget, ILaunchConfigurationService, LaunchTarget } from '../lsptoolshost/services/ILaunchConfigurationService';
import Descriptors from '../lsptoolshost/services/Descriptors';
import { IRemoteServiceBroker, IServiceBroker } from '@microsoft/servicehub-framework';
import { IBuildService } from '../lsptoolshost/services/IBuildService';
import { PlatformInformation } from './platform';

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

const workspaceFolderToken: string = "${workspaceFolder}";
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
    constructor(private workspaceDebugInfoProvider: IWorkspaceDebugInformationProvider, private platformInformation: PlatformInformation) {}

    //#region vscode.DebugConfigurationProvider

    async resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
        /** This {@link vscode.DebugConfigurationProvider} does not handle Run and Debug */
        if (Object.keys(debugConfiguration).length == 0) {
            return debugConfiguration;
        }

        if (debugConfiguration.request !== "launch") {
            throw new Error(`'${debugConfiguration.request}' is unsupported.`);
        }

        let projectPath: string = debugConfiguration.projectPath;
        if (folder && projectPath)
        {
            projectPath = resolveWorkspaceFolderToken(projectPath, folder.uri.fsPath);

            try {
                let configurationServiceLaunchConfiguration = await this.resolveDebugConfigurationWithLaunchConfigurationService(projectPath, debugConfiguration.launchConfigurationId, debugConfiguration, token);
                return configurationServiceLaunchConfiguration;
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
        }

        return debugConfiguration;
    }

    //#endregion

    private async resolveDebugConfigurationWithLaunchConfigurationService(projectPath: string, activeLaunchConfigurationId: string | undefined, debugConfiguration: vscode.DebugConfiguration, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration | undefined> {
        const serviceBroker: IServiceBroker & IRemoteServiceBroker = getServiceBroker();
        const launchConfigurationServiceProxy = await serviceBroker?.getProxy<ILaunchConfigurationService>(Descriptors.launchConfigurationService);
        const buildServiceProxy = await serviceBroker?.getProxy<IBuildService>(Descriptors.buildService);

        if (serviceBroker && launchConfigurationServiceProxy && buildServiceProxy) {
            try {
                await this.buildProject(projectPath, buildServiceProxy);

                if (activeLaunchConfigurationId) {
                    const setActiveLaunchConfigurationSuccess: boolean = await launchConfigurationServiceProxy.setActiveLaunchConfiguration(projectPath, activeLaunchConfigurationId, token);
                    if (!setActiveLaunchConfigurationSuccess) {
                        throw new LaunchServiceError(`Unable to set '${activeLaunchConfigurationId}' as the active configuration. Please delete this configuration and generate a new one.`);
                    }
                }

                let debugConfigurations: vscode.DebugConfiguration[] = [];
                const noDebug: boolean = debugConfiguration.noDebug ?? false;
                const preferSSL: boolean = !this.platformInformation.isLinux() && !vscode.env.remoteName && vscode.env.uiKind != vscode.UIKind.Web;
                const launchTargets: LaunchTarget[] = await launchConfigurationServiceProxy.queryLaunchTargets(projectPath, {noDebug: noDebug, preferSSL: preferSSL}, token);
                const convertedLaunchTargets: vscode.DebugConfiguration[] | undefined = LaunchTargetToDebugConfigurationConverter.convert(debugConfiguration, launchTargets);

                if (convertedLaunchTargets) {
                    debugConfigurations = debugConfigurations.concat(convertedLaunchTargets);
                } else {
                    throw new InternalServiceError("Unable to convert launch target to a vscode debug configuration.");
                }

                if (debugConfigurations.length == 1) {
                    return debugConfigurations[0];
                } else if (debugConfigurations.length > 1) {
                    throw new InternalServiceError("Multiple launch targets is not yet supported.");
                } else if (debugConfigurations.length == 0) {
                    throw new LaunchServiceError(`No launchable target found for '${projectPath}'`);
                }
            } finally {
                launchConfigurationServiceProxy?.dispose();
                buildServiceProxy?.dispose();
            }
        }

        throw new UnavaliableLaunchServiceError();
    }

    private async buildProject(projectPath: string, buildServiceProxy: IBuildService): Promise<void> {
        if (!await buildServiceProxy.build(projectPath))
        {
            const yesOption: vscode.MessageItem = {title: "Yes"};
            const noOption: vscode.MessageItem = {title: "No", isCloseAffordance: true};
            // TODO: Handle 'Do not show this dialog again'
            const messageOptions: vscode.MessageOptions = {
                modal: true,
                detail: `'${projectPath}' failed to build. Would you like to continue and run the last successful build?`
            };
            
            const selectedOption: vscode.MessageItem | undefined = await vscode.window.showErrorMessage("Build Failures", messageOptions, yesOption, noOption);
            if (selectedOption !== yesOption) {
                throw new StopDebugLaunchServiceError();
            }
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

class LaunchTargetToDebugConfigurationConverter {
    static convert(debugConfiguration: vscode.DebugConfiguration, launchTargets: LaunchTarget[]): vscode.DebugConfiguration[] | undefined {
        let debugConfigurations: vscode.DebugConfiguration[] = [];

        for (let launchTarget of launchTargets)
        {
            if (launchTarget.debugEngines.length > 1) {
                throw new InternalServiceError(`Multiple debug engines are currently unsupported: '${launchTarget.debugEngines.join(",")}'`);
            }

            if (ExeLaunchTarget.is(launchTarget)) {
                debugConfigurations.push(LaunchTargetToDebugConfigurationConverter.convertExeLaunchTarget(debugConfiguration, launchTarget));
            } else if (BrowserLaunchTarget.is(launchTarget)) {
                const lastConfig: vscode.DebugConfiguration | undefined = debugConfigurations.pop();
                if (lastConfig) {
                    const browserLaunchTarget: any = LaunchTargetToDebugConfigurationConverter.convertBrowserLaunchTarget(launchTarget);
                    debugConfigurations.push({
                        ...lastConfig,
                        ...browserLaunchTarget
                    });
                } else {
                    throw new InternalServiceError(`Expected an ExeLaunchTarget before seeing a BrowserLaunchTarget.`);
                }
            } else if (CustomLaunchTarget.is(launchTarget)) {
                throw new InternalServiceError(`CustomLaunchTarget is not implemented.\nDebugConfiguration: ${debugConfiguration}\nLaunchTarget: ${launchTarget}`);
            } else if (ErrorLaunchTarget.is(launchTarget)) {
                // TODO: Handle launchTarget.details
                throw new LaunchServiceError(launchTarget.userMessage);
            } else {
                throw new InternalServiceError(`Unknown LaunchTarget type: '${launchTarget.constructor.name}'`);
            }
        }

        return debugConfigurations;
    }

    private static convertExeLaunchTarget(debugConfiguration: vscode.DebugConfiguration, exeLaunchTarget: ExeLaunchTarget): vscode.DebugConfiguration {
        return {
            "name": debugConfiguration.name,
            "type": exeLaunchTarget.debugEngines[0],
            "request": debugConfiguration.request,
            "program": exeLaunchTarget.executable,
            "args": exeLaunchTarget.commandLineArguments,
            "cwd": exeLaunchTarget.directory,
            "env": exeLaunchTarget.environmentVariables,
            "console": exeLaunchTarget.isConsoleApp ? AssetGenerator.getConsoleDebugOption() : "internalConsole",
            "checkForDevCert": exeLaunchTarget.isUsingSSL
        };
    }

    private static convertBrowserLaunchTarget(browserLaunchTarget: BrowserLaunchTarget): any {
        return {
            "serverReadyAction": {
                "action": "openExternally",
                "pattern": "\\bNow listening on:\\s+https?://\\S+",
                "uriFormat" : browserLaunchTarget.url,
            }
        };
    }
}