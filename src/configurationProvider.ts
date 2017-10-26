/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { parse } from 'jsonc-parser';
import { OmniSharpServer } from './omnisharp/server';
import * as serverUtils from './omnisharp/utils';
import { AssetGenerator, addTasksJsonIfNecessary, createLaunchConfiguration, createAttachConfiguration, containsDotNetCoreProjects, createWebLaunchConfiguration } from './assets';

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
    private checkWorkspaceInformationMatchesWorkspaceFolder(folder: vscode.WorkspaceFolder | undefined): boolean {
        const solutionPathOrFolder: string = this.server.getSolutionPathOrFolder();
        let serverFolder = solutionPathOrFolder;

        // If its a .sln file, get the folder of the solution.
        if (fs.lstatSync(solutionPathOrFolder).isFile())
        {
            serverFolder = path.dirname(solutionPathOrFolder);
        }
        return folder && folder.uri && (folder.uri.fsPath === serverFolder);
    }

    /**
	 * Returns a list of initial debug configurations based on contextual information, e.g. package.json or folder.
	 */
    provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration[]> {
        return serverUtils.requestWorkspaceInformation(this.server).then(info => {
            const generator = new AssetGenerator(info);
            if (this.checkWorkspaceInformationMatchesWorkspaceFolder(folder) && containsDotNetCoreProjects(info)){
                const dotVscodeFolder: string = path.join(folder.uri.fsPath, '.vscode');
                const tasksJsonPath: string = path.join(dotVscodeFolder, 'tasks.json');
                
                // Make sure .vscode folder exists, addTasksJsonIfNecessary will fail to create tasks.json if the folder does not exist. 
                fs.ensureDirSync(dotVscodeFolder);
    
                // if the file does not exist, addTasksJson
                const addTasksJson: boolean = !fs.existsSync(tasksJsonPath);
    
                return addTasksJsonIfNecessary(generator, {addTasksJson: addTasksJson}).then(() => {
                    const isWebProject = generator.hasWebServerDependency();
                    const launchJson: string = generator.createLaunchJson(isWebProject);
    
                    // jsonc-parser's parse function parses a JSON string with comments into a JSON object. However, this removes the comments. 
                    return parse(launchJson);
                });
            }
            else {
                // Error to write default C# configurations.
                throw new Error("Does not contain dotnet core projects.");
            }
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
	 * Try to add all missing attributes to the debug configuration being launched.
	 */
	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
        // vsdbg does the error checking
        return config;
    }   
}