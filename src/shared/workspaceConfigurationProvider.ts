/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as vscode from 'vscode';

import { AssetGenerator, AssetOperations, addTasksJsonIfNecessary, createAttachConfiguration, createFallbackLaunchConfiguration, getBuildOperations } from './assets';
import { parse } from 'jsonc-parser';
import { IWorkspaceDebugInformationProvider } from './IWorkspaceDebugInformationProvider';
import { PlatformInformation } from './platform';
import { BaseVsDbgConfigurationProvider } from './configurationProvider';
import OptionProvider from './observers/OptionProvider';

/**
 * This class will be used for providing debug configurations given workspace information.
 */
export class DotnetWorkspaceConfigurationProvider extends BaseVsDbgConfigurationProvider {

    public constructor(private workspaceDebugInfoProvider: IWorkspaceDebugInformationProvider, platformInformation: PlatformInformation, optionProvider: OptionProvider, csharpOutputChannel: vscode.OutputChannel) {
        super(platformInformation, optionProvider, csharpOutputChannel);
    }

    /**
     * Returns a list of initial debug configurations based on contextual information, e.g. package.json or folder.
     */
    async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, _?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {

        if (!folder || !folder.uri) {
            vscode.window.showErrorMessage("Cannot create .NET debug configurations. No workspace folder was selected.");
            return [];
        }

        try {
            const info = await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
            if (!info) {
                vscode.window.showErrorMessage("Cannot create .NET debug configurations. The server is still initializing or has exited unexpectedly.");
                return [];
            }

            if (info.length === 0) {
                vscode.window.showErrorMessage(`Cannot create .NET debug configurations. The active C# project is not within folder '${folder.uri.fsPath}'.`);
                return [];
            }

            const generator = new AssetGenerator(info, folder);
            if (generator.hasExecutableProjects()) {

                if (!await generator.selectStartupProject()) {
                    return [];
                }

                // Make sure .vscode folder exists, addTasksJsonIfNecessary will fail to create tasks.json if the folder does not exist.
                await fs.ensureDir(generator.vscodeFolder);

                // Add a tasks.json
                const buildOperations: AssetOperations = await getBuildOperations(generator);
                await addTasksJsonIfNecessary(generator, buildOperations);

                const programLaunchType = generator.computeProgramLaunchType();
                const launchJson: vscode.DebugConfiguration[] = generator.createLaunchJsonConfigurationsArray(programLaunchType, false);

                return launchJson;

            } else {
                // Error to be caught in the .catch() below to write default C# configurations
                throw new Error("Does not contain .NET Core projects.");
            }
        }
        catch
        {
            // Provider will always create an launch.json file. Providing default C# configurations.
            // jsonc-parser's parse to convert to JSON object without comments.
            return [
                createFallbackLaunchConfiguration(),
                parse(createAttachConfiguration())
            ];
        }
    }
}
