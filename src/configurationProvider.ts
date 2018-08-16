/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import * as serverUtils from './omnisharp/utils';
import * as vscode from 'vscode';
import { ParsedEnvironmentFile } from './coreclr-debug/ParsedEnvironmentFile';

import { AssetGenerator, addTasksJsonIfNecessary, createAttachConfiguration, createLaunchConfiguration, createWebLaunchConfiguration } from './assets';

import { OmniSharpServer } from './omnisharp/server';
import { containsDotNetCoreProjects } from './omnisharp/protocol';
import { isSubfolderOf } from './common';
import { parse } from 'jsonc-parser';
import { MessageItem } from './vscodeAdapter';

export class CSharpConfigurationProvider implements vscode.DebugConfigurationProvider {
    private server: OmniSharpServer;

    public constructor(server: OmniSharpServer) {
        this.server = server;
    }

    /**
     * TODO: Remove function when https://github.com/OmniSharp/omnisharp-roslyn/issues/909 is resolved.
     * 
     * Note: serverUtils.requestWorkspaceInformation only retrieves one folder for multi-root workspaces. Therefore, generator will be incorrect for all folders
     * except the first in a workspace. Currently, this only works if the requested folder is the same as the server's solution path or folder.
     */
    private async checkWorkspaceInformationMatchesWorkspaceFolder(folder: vscode.WorkspaceFolder | undefined): Promise<boolean> {
        const solutionPathOrFolder: string = this.server.getSolutionPathOrFolder();

        // Make sure folder, folder.uri, and solutionPathOrFolder are defined.
        if (!folder || !folder.uri || !solutionPathOrFolder)
        {
            return Promise.resolve(false);
        }

        let serverFolder = solutionPathOrFolder;
        // If its a .sln file, get the folder of the solution.
        return fs.lstat(solutionPathOrFolder).then(stat => {
            return stat.isFile();
        }).then(isFile => {
            if (isFile)
            {
                serverFolder = path.dirname(solutionPathOrFolder);
            }

            // Get absolute paths of current folder and server folder.
            const currentFolder = path.resolve(folder.uri.fsPath);
            serverFolder = path.resolve(serverFolder);

            return currentFolder && folder.uri && isSubfolderOf(serverFolder, currentFolder);
        });
    }

    /**
	 * Returns a list of initial debug configurations based on contextual information, e.g. package.json or folder.
	 */
    provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return serverUtils.requestWorkspaceInformation(this.server).then(async info => {
            return this.checkWorkspaceInformationMatchesWorkspaceFolder(folder).then(async workspaceMatches => { 
                const generator = new AssetGenerator(info);
                if (workspaceMatches && containsDotNetCoreProjects(info)) {
                    const dotVscodeFolder: string = path.join(folder.uri.fsPath, '.vscode');
                    const tasksJsonPath: string = path.join(dotVscodeFolder, 'tasks.json');
                    
                    // Make sure .vscode folder exists, addTasksJsonIfNecessary will fail to create tasks.json if the folder does not exist. 
                    return fs.ensureDir(dotVscodeFolder).then(async () => {
                        // Check to see if tasks.json exists.
                        return fs.pathExists(tasksJsonPath);
                    }).then(async tasksJsonExists => {
                        // Enable addTasksJson if it does not exist.
                        return addTasksJsonIfNecessary(generator, {addTasksJson: !tasksJsonExists});
                    }).then(() => {
                        const isWebProject = generator.hasWebServerDependency();
                        const launchJson: string = generator.createLaunchJson(isWebProject);

                        // jsonc-parser's parse function parses a JSON string with comments into a JSON object. However, this removes the comments. 
                        return parse(launchJson);
                    });
                }
                
                // Error to be caught in the .catch() below to write default C# configurations
                throw new Error("Does not contain .NET Core projects.");
            });
        }).catch((err) => {
            // Provider will always create an launch.json file. Providing default C# configurations.
            // jsonc-parser's parse to convert to JSON object without comments. 
            return [
                parse(createLaunchConfiguration(
                    "${workspaceFolder}/bin/Debug/<insert-target-framework-here>/<insert-project-name-here>.dll", 
                    '${workspaceFolder}')), 
                parse(createWebLaunchConfiguration(
                    "${workspaceFolder}/bin/Debug/<insert-target-framework-here>/<insert-project-name-here>.dll", 
                    '${workspaceFolder}')),
                parse(createAttachConfiguration())
            ];
        });
    }

    /**
     * Parse envFile and add to config.env
     */
    private parseEnvFile(envFile: string, config: vscode.DebugConfiguration): vscode.DebugConfiguration {
        if (envFile) {
            try {
                const parsedFile: ParsedEnvironmentFile = ParsedEnvironmentFile.CreateFromFile(envFile, config["env"]);
                
                // show error message if single lines cannot get parsed
                if (parsedFile.Warning) {
                    CSharpConfigurationProvider.showFileWarningAsync(parsedFile.Warning, envFile);
                }

                config.env = parsedFile.Env;
            }
            catch (e) {
                throw new Error("Can't parse envFile " + envFile);
            }
        }

        // remove envFile from config after parsing
        if (config.envFile) {
            delete config.envFile;
        }

        return config;
    }

    /**
	 * Try to add all missing attributes to the debug configuration being launched.
	 */
    resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {

        // read from envFile and set config.env
        if (config.envFile) {
            config = this.parseEnvFile(config.envFile.replace(/\${workspaceFolder}/g, folder.uri.path), config);
        }

        // vsdbg will error check the debug configuration fields      
        return config;
    }   

    private static async showFileWarningAsync(message: string, fileName: string) {
        const openItem: MessageItem = { title: 'Open envFile' };
        let result: MessageItem = await vscode.window.showWarningMessage(message, openItem);
        if (result && result.title === openItem.title) {
            let doc: vscode.TextDocument = await vscode.workspace.openTextDocument(fileName);
            if (doc) {
                vscode.window.showTextDocument(doc);
            }
        }
    }
}