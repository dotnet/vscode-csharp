/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as vscode from 'vscode';
import { ParsedEnvironmentFile } from '../coreclr-debug/ParsedEnvironmentFile';

import { AssetGenerator, AssetOperations, addTasksJsonIfNecessary, createAttachConfiguration, createFallbackLaunchConfiguration, getBuildOperations } from './assets';

import { parse } from 'jsonc-parser';
import { MessageItem } from '../vscodeAdapter';
import { IWorkspaceDebugInformationProvider } from './IWorkspaceDebugInformationProvider';

export class CSharpConfigurationProvider implements vscode.DebugConfigurationProvider {

    public constructor(private workspaceDebugInfoProvider: IWorkspaceDebugInformationProvider) { }

    /**
	 * Returns a list of initial debug configurations based on contextual information, e.g. package.json or folder.
	 */
    async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {

        if (!folder || !folder.uri) {
            vscode.window.showErrorMessage("Cannot create .NET debug configurations. No workspace folder was selected.");
            return [];
        }

        try {
            let info = await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
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
                const launchJson: vscode.DebugConfiguration[] = generator.createLaunchJsonConfigurationsArray(programLaunchType);

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

    /**
     * Parse envFile and add to config.env
     */
    private parseEnvFile(envFile: string, config: vscode.DebugConfiguration): vscode.DebugConfiguration {
        try {
            const parsedFile = ParsedEnvironmentFile.CreateFromFile(envFile, config["env"]);

            // show error message if single lines cannot get parsed
            if (parsedFile.Warning) {
                CSharpConfigurationProvider.showFileWarningAsync(parsedFile.Warning, envFile);
            }

            config.env = parsedFile.Env;
        }
        catch (e) {
            throw new Error(`Can't parse envFile ${envFile} because of ${e}`);
        }

        // remove envFile from config after parsing
        delete config.envFile;

        return config;
    }

    /**
	 * Try to add all missing attributes to the debug configuration being launched.
	 */
    resolveDebugConfigurationWithSubstitutedVariables(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {

        if (!config.type) {
            // If the config doesn't look functional force VSCode to open a configuration file https://github.com/Microsoft/vscode/issues/54213
            return null;
        }

        if (config.request === "launch") {
            if (!config.cwd && !config.pipeTransport) {
                config.cwd = folder?.uri.fsPath; // Workspace folder
            }

            config.internalConsoleOptions ??= "openOnSessionStart";

            // read from envFile and set config.env
            if (config.envFile !== undefined && config.envFile.length > 0) {
                config = this.parseEnvFile(config.envFile, config);
            }
        }

        return config;
    }

    private static async showFileWarningAsync(message: string, fileName: string) {
        const openItem: MessageItem = { title: 'Open envFile' };
        const result = await vscode.window.showWarningMessage(message, openItem);
        if (result?.title === openItem.title) {
            const doc = await vscode.workspace.openTextDocument(fileName);
            await vscode.window.showTextDocument(doc);
        }
    }
}
