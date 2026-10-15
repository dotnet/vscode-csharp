/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {
    AssetGenerator,
    AssetOperations,
    addTasksJsonIfNecessary,
    createAttachConfiguration,
    createFallbackLaunchConfiguration,
    getBuildOperations,
} from './assets';
import { parse } from 'jsonc-parser';
import { IWorkspaceDebugInformationProvider } from './IWorkspaceDebugInformationProvider';
import { PlatformInformation } from './platform';
import { BaseVsDbgConfigurationProvider } from './configurationProvider';
import { showErrorMessage } from './observers/utils/showMessage';

/**
 * This class will be used for providing debug configurations given workspace information.
 */
export class DotnetWorkspaceConfigurationProvider extends BaseVsDbgConfigurationProvider {
    public constructor(
        private workspaceDebugInfoProvider: IWorkspaceDebugInformationProvider,
        platformInformation: PlatformInformation,
        csharpOutputChannel: vscode.OutputChannel
    ) {
        super(platformInformation, csharpOutputChannel);
    }

    /**
     * Returns a list of initial debug configurations based on contextual information, e.g. package.json or folder.
     */
    async provideDebugConfigurations(
        folder: vscode.WorkspaceFolder | undefined,
        _?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration[]> {
        if (!folder || !folder.uri) {
            showErrorMessage(
                vscode,
                vscode.l10n.t('Cannot create .NET debug configurations. No workspace folder was selected.')
            );
            return [];
        }

        try {
            const info = await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
            if (!info) {
                showErrorMessage(
                    vscode,
                    vscode.l10n.t(
                        'Cannot create .NET debug configurations. The server is still initializing or has exited unexpectedly.'
                    )
                );
                return [];
            }

            if (info.length === 0) {
                showErrorMessage(
                    vscode,
                    vscode.l10n.t(
                        "Cannot create .NET debug configurations. The active C# project is not within folder '{0}'.",
                        folder.uri.fsPath
                    )
                );
                return [];
            }

            const generator = new AssetGenerator(info, folder);
            if (generator.hasExecutableProjects()) {
                if (!(await generator.selectStartupProject())) {
                    return [];
                }

                // Make sure .vscode folder exists, addTasksJsonIfNecessary will fail to create tasks.json if the folder does not exist.
                await fs.mkdir(generator.vscodeFolder, { recursive: true });

                // Add a tasks.json
                const buildOperations: AssetOperations = await getBuildOperations(generator);
                await addTasksJsonIfNecessary(generator, buildOperations);

                const programLaunchType = generator.computeProgramLaunchType();
                const launchJson: vscode.DebugConfiguration[] = generator.createLaunchJsonConfigurationsArray(
                    programLaunchType,
                    false
                );

                return launchJson;
            } else {
                // Error to be caught in the .catch() below to write default C# configurations
                throw new Error(vscode.l10n.t('Does not contain .NET Core projects.'));
            }
        } catch {
            // Provider will always create an launch.json file. Providing default C# configurations.
            // jsonc-parser's parse to convert to JSON object without comments.
            return [createFallbackLaunchConfiguration(), parse(createAttachConfiguration())];
        }
    }

    async getAssetsPathAndProgram(folder: vscode.WorkspaceFolder, projectPath?: string): Promise<[string, string]> {
        const generator = await this.getWasmAssetGenerator(folder, projectPath);
        if (!generator) {
            return ['', ''];
        }
        return generator.getAssetsPathAndProgram();
    }

    async getNet9WasmAssetsPathAndProgram(
        folder: vscode.WorkspaceFolder,
        projectPath?: string
    ): Promise<[string, string] | undefined> {
        const generator = await this.getWasmAssetGenerator(folder, projectPath);
        if (!generator) {
            return undefined;
        }
        return generator.getNet9WasmAssetsPathAndProgram();
    }

    private async getWasmAssetGenerator(
        folder: vscode.WorkspaceFolder,
        projectPath?: string
    ): Promise<AssetGenerator | undefined> {
        const info = await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
        if (!info) {
            return undefined;
        }

        const normalizePath = (value: string) => {
            const fullPath = path.resolve(folder.uri.fsPath, value);
            return process.platform === 'win32' ? fullPath.toLowerCase() : fullPath;
        };
        const normalizedProjectPath = projectPath && normalizePath(projectPath);
        const projects = normalizedProjectPath
            ? info.filter((project) => normalizePath(project.projectPath) === normalizedProjectPath)
            : info;

        const generator = new AssetGenerator(projects, folder);
        if (projectPath && !generator.getAssetsPathAndProgram()[1]) {
            // An invalid explicit project should report an error, not silently cancel debugging.
            throw new Error(
                vscode.l10n.t("Unable to determine WebAssembly debug settings for project '{0}'.", projectPath)
            );
        }

        return generator;
    }

    async isDotNet9OrNewer(folder: vscode.WorkspaceFolder): Promise<boolean> {
        const info = await this.workspaceDebugInfoProvider.getWorkspaceDebugInformation(folder.uri);
        if (!info) {
            return false;
        }
        const generator = new AssetGenerator(info, folder);
        return generator.isDotNet9OrNewer();
    }

    isDotnetWorkspaceConfigurationProvider(): boolean {
        return true;
    }
}
