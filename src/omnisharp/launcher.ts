/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'cross-spawn';
import { ChildProcessWithoutNullStreams } from 'child_process';

import { PlatformInformation } from '../shared/platform';
import * as path from 'path';
import * as vscode from 'vscode';
import { commonOptions, omnisharpOptions } from '../shared/options';
import { IHostExecutableResolver } from '../shared/constants/IHostExecutableResolver';
import { LaunchTarget, LaunchTargetKind, createLaunchTargetForSolution } from '../shared/launchTarget';

export const vslsTarget: LaunchTarget = {
    label: 'VSLS',
    description: 'Visual Studio Live Share',
    directory: '',
    target: '',
    workspaceKind: LaunchTargetKind.LiveShare,
};

/** Live share scheme */
export const vsls = 'vsls';

/*
 * File scheme for which OmniSharp language feature should be disabled
 */
export const disabledSchemes = new Set([vsls]);

/**
 * Returns a list of potential targets on which OmniSharp can be launched.
 * This includes `*.sln` and `*.slnf` files (if any `*.csproj` files are found), and the root folder
 * In addition, the root folder is included if there are any `*.csproj` files present, but a `*.sln` or `*.slnf` file is not found.
 */
export async function findLaunchTargets(): Promise<LaunchTarget[]> {
    if (!vscode.workspace.workspaceFolders) {
        return Promise.resolve([]);
    }

    const projectFiles = await vscode.workspace.findFiles(
        /*include*/ '{**/*.sln,**/*.slnf,**/*.csproj,**/*.csx,**/*.cake}',
        /*exclude*/ `{${omnisharpOptions.projectFilesExcludePattern}}`
    );

    const csFiles = await vscode.workspace.findFiles(
        /*include*/ '{**/*.cs}',
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ 1
    );

    return resourcesToLaunchTargets(
        projectFiles.concat(csFiles),
        vscode.workspace.workspaceFolders,
        omnisharpOptions.maxProjectResults
    );
}

export function resourcesToLaunchTargets(
    resources: vscode.Uri[],
    workspaceFolders: readonly vscode.WorkspaceFolder[],
    maxProjectResults: number
): LaunchTarget[] {
    // The list of launch targets is calculated like so:
    //   * If there are .csproj files, .sln and .slnf files are considered as launch targets.
    //   * Additionally, if there are .csproj files, but no .sln or .slnf file, the root is added as a launch target.
    //
    // TODO:
    //   * It should be possible to choose a .csproj as a launch target
    //   * It should be possible to choose a .sln or .slnf file even when no .csproj files are found
    //     within the root.

    if (resources.length === 0) {
        return [];
    }

    // Since language server functionality is run on the server instance there is no need
    // to start OmniSharp on the LiveShare client.
    const localResources = resources.filter((resource) => !disabledSchemes.has(resource.scheme));
    if (localResources.length === 0) {
        return [vslsTarget];
    }

    const workspaceFolderToUriMap = new Map<number, vscode.Uri[]>();

    for (const resource of localResources) {
        const folder = vscode.workspace.getWorkspaceFolder(resource);
        if (folder) {
            let buckets: vscode.Uri[];

            if (workspaceFolderToUriMap.has(folder.index)) {
                buckets = workspaceFolderToUriMap.get(folder.index)!; // Ensured valid via has.
            } else {
                buckets = [];
                workspaceFolderToUriMap.set(folder.index, buckets);
            }

            buckets.push(resource);
        }
    }

    return resourcesAndFolderMapToLaunchTargets(
        resources,
        workspaceFolders,
        workspaceFolderToUriMap,
        maxProjectResults
    );
}

export function resourcesAndFolderMapToLaunchTargets(
    resources: vscode.Uri[],
    workspaceFolders: readonly vscode.WorkspaceFolder[],
    workspaceFolderToUriMap: Map<number, vscode.Uri[]>,
    maxProjectResults: number
): LaunchTarget[] {
    let solutionTargets: LaunchTarget[] = [];
    let projectJsonTargets: LaunchTarget[] = [];
    let projectRootTargets: LaunchTarget[] = [];
    let projectTargets: LaunchTarget[] = [];
    const otherTargets: LaunchTarget[] = [];

    workspaceFolderToUriMap.forEach((resources, folderIndex) => {
        let hasCSX = false;
        let hasCake = false;
        let hasCs = false;

        const folder = workspaceFolders[folderIndex];
        const folderPath = folder.uri.fsPath;

        resources.forEach((resource) => {
            // Add .sln and .slnf files
            if (isSolution(resource)) {
                solutionTargets.push(createLaunchTargetForSolution(resource));
            }
            // Add .csproj files
            else if (isCSharpProject(resource)) {
                const dirname = path.dirname(resource.fsPath);
                // OmniSharp doesn't support opening a project directly, however, it will open a project if
                // we pass a folder path which contains a single .csproj.
                projectTargets.push({
                    label: path.basename(resource.fsPath),
                    description: vscode.workspace.asRelativePath(dirname),
                    target: dirname,
                    directory: dirname,
                    workspaceKind: LaunchTargetKind.Project,
                });
            } else {
                // Discover if there is any CSX file
                hasCSX ||= isCsx(resource);

                // Discover if there is any Cake file
                hasCake ||= isCake(resource);

                //Discover if there is any cs file
                hasCs ||= isCs(resource);
            }
        });

        const hasCsProjFiles = projectTargets.length > 0;
        const hasSlnFile = solutionTargets.length > 0;

        // Add the root folder under the following circumstances:
        // * If there are .csproj files, but no .sln or .slnf file, and none in the root.
        if (hasCsProjFiles && !hasSlnFile) {
            projectRootTargets.push({
                label: path.basename(folderPath),
                description: 'All contained projects',
                target: folderPath,
                directory: folderPath,
                workspaceKind: LaunchTargetKind.Folder,
            });
        }

        // if we noticed any CSX file(s), add a single CSX-specific target pointing at the root folder
        if (hasCSX) {
            otherTargets.push({
                label: 'CSX',
                description: path.basename(folderPath),
                target: folderPath,
                directory: folderPath,
                workspaceKind: LaunchTargetKind.Csx,
            });
        }

        // if we noticed any Cake file(s), add a single Cake-specific target pointing at the root folder
        if (hasCake) {
            otherTargets.push({
                label: 'Cake',
                description: path.basename(folderPath),
                target: folderPath,
                directory: folderPath,
                workspaceKind: LaunchTargetKind.Cake,
            });
        }

        if (hasCs && !hasSlnFile && !hasCsProjFiles) {
            otherTargets.push({
                label: path.basename(folderPath),
                description: '',
                target: folderPath,
                directory: folderPath,
                workspaceKind: LaunchTargetKind.Folder,
            });
        }
    });

    solutionTargets = solutionTargets.sort((a, b) => a.directory.localeCompare(b.directory));
    projectRootTargets = projectRootTargets.sort((a, b) => a.directory.localeCompare(b.directory));
    projectJsonTargets = projectJsonTargets.sort((a, b) => a.directory.localeCompare(b.directory));
    projectTargets = projectTargets.sort((a, b) => a.directory.localeCompare(b.directory));

    const allTargets = otherTargets
        .concat(solutionTargets)
        .concat(projectRootTargets)
        .concat(projectJsonTargets)
        .concat(projectTargets);

    return maxProjectResults > 0 ? allTargets.slice(0, maxProjectResults) : allTargets;
}

function isCSharpProject(resource: vscode.Uri): boolean {
    return /\.csproj$/i.test(resource.fsPath);
}

function isSolution(resource: vscode.Uri): boolean {
    return /\.slnf?$/i.test(resource.fsPath);
}

function isCsx(resource: vscode.Uri): boolean {
    return /\.csx$/i.test(resource.fsPath);
}

function isCake(resource: vscode.Uri): boolean {
    return /\.cake$/i.test(resource.fsPath);
}

function isCs(resource: vscode.Uri): boolean {
    return /\.cs$/i.test(resource.fsPath);
}

// A ChildProcess that has spawned successfully without erroring.
// We can guarantee that certain optional properties will exist in this case.
// (Technically, this includes stderr/in/out, but ChildProcessWithoutNullStreams
// gives us that for free even though it really shouldn't.)
export interface SpawnedChildProcess extends ChildProcessWithoutNullStreams {
    pid: number;
}

export interface LaunchResult extends IntermediateLaunchResult {
    process: SpawnedChildProcess;
}

interface IntermediateLaunchResult {
    process: ChildProcessWithoutNullStreams;
    command: string;
    hostIsMono: boolean;
    hostVersion?: string;
    hostPath?: string;
}

export interface LaunchConfiguration {
    hostKind: '.NET' | 'Windows .NET Framework' | 'Mono .NET Framework';
    hostPath: string;
    hostVersion: string;
    path: string;
    launchPath: string;
    cwd: string;
    args: string[];
    env: NodeJS.ProcessEnv;
}

export async function launchOmniSharp(
    cwd: string,
    args: string[],
    launchPath: string,
    platformInfo: PlatformInformation,
    monoResolver: IHostExecutableResolver,
    dotnetResolver: IHostExecutableResolver
): Promise<LaunchResult> {
    return new Promise((resolve, reject) => {
        launch(cwd, args, launchPath, platformInfo, monoResolver, dotnetResolver)
            .then((result) => {
                // async error - when target not not ENEOT
                result.process.on('error', (err) => {
                    reject(err);
                });

                result.process.on('spawn', () => {
                    resolve(result as LaunchResult);
                });
            })
            .catch((reason) => reject(reason));
    });
}

export async function configure(
    cwd: string,
    args: string[],
    launchPath: string,
    platformInfo: PlatformInformation,
    monoResolver: IHostExecutableResolver,
    dotnetResolver: IHostExecutableResolver
): Promise<LaunchConfiguration> {
    if (omnisharpOptions.useEditorFormattingSettings) {
        const globalConfig = vscode.workspace.getConfiguration('', null);
        const csharpConfig = vscode.workspace.getConfiguration('[csharp]', null);

        args.push(
            `formattingOptions:useTabs=${!getConfigurationValue(
                globalConfig,
                csharpConfig,
                'editor.insertSpaces',
                true
            )}`
        );
        args.push(
            `formattingOptions:tabSize=${getConfigurationValue(globalConfig, csharpConfig, 'editor.tabSize', 4)}`
        );
        args.push(
            `formattingOptions:indentationSize=${getConfigurationValue(
                globalConfig,
                csharpConfig,
                'editor.tabSize',
                4
            )}`
        );
    }

    if (omnisharpOptions.useModernNet) {
        const argsCopy = args.slice(0);

        let command: string;
        if (!launchPath.endsWith('.dll')) {
            // If we're not being asked to launch a dll, assume whatever we're given is an executable
            command = launchPath;
        } else {
            command = platformInfo.isWindows() ? 'dotnet.exe' : 'dotnet';
            argsCopy.unshift(launchPath);
        }

        const dotnetInfo = await dotnetResolver.getHostExecutableInfo();

        return {
            hostKind: '.NET',
            hostPath: dotnetInfo.path,
            hostVersion: dotnetInfo.version,
            path: command,
            launchPath: launchPath,
            cwd,
            args: argsCopy,
            env: dotnetInfo.env,
        };
    }

    if (platformInfo.isWindows()) {
        return {
            hostKind: 'Windows .NET Framework',
            hostPath: '',
            hostVersion: '',
            path: launchPath,
            launchPath: launchPath,
            cwd,
            args,
            env: process.env,
        };
    }

    const monoInfo = await monoResolver.getHostExecutableInfo();
    if (monoInfo !== undefined) {
        const argsCopy = args.slice(0); // create copy of details args
        argsCopy.unshift(launchPath);
        argsCopy.unshift('--assembly-loader=strict');

        if (commonOptions.waitForDebugger) {
            argsCopy.unshift('--debug');
            argsCopy.unshift('--debugger-agent=transport=dt_socket,server=y,address=127.0.0.1:55555');
        }

        return {
            hostKind: 'Mono .NET Framework',
            hostPath: monoInfo.path,
            hostVersion: monoInfo.version,
            path: 'mono',
            launchPath,
            cwd,
            args: argsCopy,
            env: monoInfo.env,
        };
    }

    throw new Error('Unable to find Mono installation.');
}

async function launch(
    cwd: string,
    args: string[],
    launchPath: string,
    platformInfo: PlatformInformation,
    monoResolver: IHostExecutableResolver,
    dotnetResolver: IHostExecutableResolver
): Promise<IntermediateLaunchResult> {
    const configureResults = await configure(cwd, args, launchPath, platformInfo, monoResolver, dotnetResolver);
    return coreLaunch(platformInfo, configureResults);
}

function coreLaunch(platformInfo: PlatformInformation, configuration: LaunchConfiguration): IntermediateLaunchResult {
    const { cwd, args, path, launchPath, env } = configuration;

    switch (configuration.hostKind) {
        case '.NET': {
            const process = spawn(path, args, { detached: false, cwd, env });

            return {
                process,
                command: launchPath,
                hostIsMono: false,
                hostVersion: configuration.hostVersion,
                hostPath: configuration.hostPath,
            };
            break;
        }
        case 'Windows .NET Framework': {
            return launchWindows(path, cwd, args);
        }
        case 'Mono .NET Framework': {
            return {
                command: launchPath,
                process: launchNixMono(configuration.hostPath, cwd, args, configuration.env),
                hostIsMono: true,
                hostVersion: configuration.hostVersion,
                hostPath: configuration.hostPath,
            };
        }
    }
}

function getConfigurationValue(
    globalConfig: vscode.WorkspaceConfiguration,
    csharpConfig: vscode.WorkspaceConfiguration,
    configurationPath: string,
    defaultValue: any
): any {
    if (csharpConfig[configurationPath] != undefined) {
        return csharpConfig[configurationPath];
    }

    return globalConfig.get(configurationPath, defaultValue);
}

function launchWindows(launchPath: string, cwd: string, args: string[]): IntermediateLaunchResult {
    function escapeIfNeeded(arg: string) {
        const hasSpaceWithoutQuotes = /^[^"].* .*[^"]/;
        return hasSpaceWithoutQuotes.test(arg) ? `"${arg}"` : arg.replace('&', '^&');
    }

    let argsCopy = args.slice(0); // create copy of args
    argsCopy.unshift(`"${launchPath}"`);
    argsCopy = [['/s', '/c', '"' + argsCopy.map(escapeIfNeeded).join(' ') + '"'].join(' ')];

    const process = spawn('cmd', argsCopy, {
        windowsVerbatimArguments: true,
        detached: false,
        cwd: cwd,
    });

    return {
        process,
        command: launchPath,
        hostIsMono: false,
    };
}

function launchNixMono(
    launchPath: string,
    cwd: string,
    args: string[],
    environment: NodeJS.ProcessEnv
): ChildProcessWithoutNullStreams {
    const process = spawn('mono', args, {
        detached: false,
        cwd: cwd,
        env: environment,
    });

    return process;
}
