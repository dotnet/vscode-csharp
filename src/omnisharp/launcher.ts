/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn, ChildProcess } from 'child_process';

import { PlatformInformation } from '../platform';
import * as path from 'path';
import * as vscode from 'vscode';
import { Options } from './options';
import { LaunchInfo } from './OmnisharpManager';
import { IMonoResolver } from '../constants/IMonoResolver';

export enum LaunchTargetKind {
    Solution,
    ProjectJson,
    Folder,
    Csx,
    Cake,
    LiveShare
}

/**
 * Represents the project or solution that OmniSharp is to be launched with.
 * */
export interface LaunchTarget {
    label: string;
    description: string;
    directory: string;
    target: string;
    kind: LaunchTargetKind;
}

export const vslsTarget: LaunchTarget = {
    label: "VSLS",
    description: "Visual Studio Live Share",
    directory: "",
    target: "",
    kind: LaunchTargetKind.LiveShare
};

/** Live share scheme */
export const vsls = 'vsls';

/*
 * File scheme for which OmniSharp language feature should be disabled
 */
export const disabledSchemes = new Set([
    vsls,
]);

/**
 * Returns a list of potential targets on which OmniSharp can be launched.
 * This includes `project.json` files, `*.sln` and `*.slnf` files (if any `*.csproj` files are found), and the root folder
 * (if it doesn't contain a `project.json` file, but `project.json` files exist). In addition, the root folder
 * is included if there are any `*.csproj` files present, but a `*.sln` or `*.slnf` file is not found.
 */
export async function findLaunchTargets(options: Options): Promise<LaunchTarget[]> {
    if (!vscode.workspace.workspaceFolders) {
        return Promise.resolve([]);
    }

    const projectFiles = await vscode.workspace.findFiles(
        /*include*/ '{**/*.sln,**/*.slnf,**/*.csproj,**/project.json,**/*.csx,**/*.cake}',
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ options.maxProjectResults);

    const csFiles = await vscode.workspace.findFiles(
        /*include*/ '{**/*.cs}',
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ options.maxProjectResults);

    return resourcesToLaunchTargets(projectFiles.concat(csFiles));
}

export function resourcesToLaunchTargets(resources: vscode.Uri[]): LaunchTarget[] {
    // The list of launch targets is calculated like so:
    //   * If there are .csproj files, .sln and .slnf files are considered as launch targets.
    //   * Any project.json file is considered a launch target.
    //   * If there is no project.json file in a workspace folder, the workspace folder as added as a launch target.
    //   * Additionally, if there are .csproj files, but no .sln or .slnf file, the root is added as a launch target.
    //
    // TODO:
    //   * It should be possible to choose a .csproj as a launch target
    //   * It should be possible to choose a .sln or .slnf file even when no .csproj files are found
    //     within the root.

    if (!Array.isArray(resources) || resources.length === 0) {
        return [];
    }

    // Since language server functionality is run on the server instance there is no need
    // to start OmniSharp on the LiveShare client.
    const localResources = resources.filter(resource => !disabledSchemes.has(resource.scheme));
    if (localResources.length === 0) {
        return [vslsTarget];
    }

    let workspaceFolderToUriMap = new Map<number, vscode.Uri[]>();

    for (let resource of localResources) {
        let folder = vscode.workspace.getWorkspaceFolder(resource);
        if (folder) {
            let buckets: vscode.Uri[];

            if (workspaceFolderToUriMap.has(folder.index)) {
                buckets = workspaceFolderToUriMap.get(folder.index);
            } else {
                buckets = [];
                workspaceFolderToUriMap.set(folder.index, buckets);
            }

            buckets.push(resource);
        }
    }

    let targets: LaunchTarget[] = [];

    workspaceFolderToUriMap.forEach((resources, folderIndex) => {
        let hasCsProjFiles = false,
            hasSlnFile = false,
            hasProjectJson = false,
            hasProjectJsonAtRoot = false,
            hasCSX = false,
            hasCake = false,
            hasCs = false;

        hasCsProjFiles = resources.some(isCSharpProject);

        let folder = vscode.workspace.workspaceFolders[folderIndex];
        let folderPath = folder.uri.fsPath;

        resources.forEach(resource => {
            // Add .sln and .slnf files if there are .csproj files
            if (hasCsProjFiles && isSolution(resource)) {
                hasSlnFile = true;
                targets.push({
                    label: path.basename(resource.fsPath),
                    description: vscode.workspace.asRelativePath(path.dirname(resource.fsPath)),
                    target: resource.fsPath,
                    directory: path.dirname(resource.fsPath),
                    kind: LaunchTargetKind.Solution
                });
            }

            // Add project.json files
            if (isProjectJson(resource)) {
                const dirname = path.dirname(resource.fsPath);
                hasProjectJson = true;
                hasProjectJsonAtRoot = hasProjectJsonAtRoot || dirname === folderPath;

                targets.push({
                    label: path.basename(resource.fsPath),
                    description: vscode.workspace.asRelativePath(path.dirname(resource.fsPath)),
                    target: dirname,
                    directory: dirname,
                    kind: LaunchTargetKind.ProjectJson
                });
            }

            // Discover if there is any CSX file
            if (!hasCSX && isCsx(resource)) {
                hasCSX = true;
            }

            // Discover if there is any Cake file
            if (!hasCake && isCake(resource)) {
                hasCake = true;
            }

            //Discover if there is any cs file
            if (!hasCs && isCs(resource)) {
                hasCs = true;
            }
        });

        // Add the root folder under the following circumstances:
        // * If there are .csproj files, but no .sln or .slnf file, and none in the root.
        // * If there are project.json files, but none in the root.
        if ((hasCsProjFiles && !hasSlnFile) || (hasProjectJson && !hasProjectJsonAtRoot)) {
            targets.push({
                label: path.basename(folderPath),
                description: '',
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Folder
            });
        }

        // if we noticed any CSX file(s), add a single CSX-specific target pointing at the root folder
        if (hasCSX) {
            targets.push({
                label: "CSX",
                description: path.basename(folderPath),
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Csx
            });
        }

        // if we noticed any Cake file(s), add a single Cake-specific target pointing at the root folder
        if (hasCake) {
            targets.push({
                label: "Cake",
                description: path.basename(folderPath),
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Cake
            });
        }

        if (hasCs && !hasSlnFile && !hasCsProjFiles && !hasProjectJson && !hasProjectJsonAtRoot) {
            targets.push({
                label: path.basename(folderPath),
                description: '',
                target: folderPath,
                directory: folderPath,
                kind: LaunchTargetKind.Folder
            });
        }
    });

    return targets.sort((a, b) => a.directory.localeCompare(b.directory));
}

function isCSharpProject(resource: vscode.Uri): boolean {
    return /\.csproj$/i.test(resource.fsPath);
}

function isSolution(resource: vscode.Uri): boolean {
    return /\.slnf?$/i.test(resource.fsPath);
}

function isProjectJson(resource: vscode.Uri): boolean {
    return /\project.json$/i.test(resource.fsPath);
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

export interface LaunchResult {
    process: ChildProcess;
    command: string;
    monoVersion?: string;
    monoPath?: string;
}

export async function launchOmniSharp(cwd: string, args: string[], launchInfo: LaunchInfo, platformInfo: PlatformInformation, options: Options, monoResolver: IMonoResolver): Promise<LaunchResult> {
    return new Promise<LaunchResult>((resolve, reject) => {
        launch(cwd, args, launchInfo, platformInfo, options, monoResolver)
            .then(result => {
                // async error - when target not not ENEOT
                result.process.on('error', err => {
                    reject(err);
                });

                // success after a short freeing event loop
                setTimeout(function () {
                    resolve(result);
                }, 0);
            })
            .catch(reason => reject(reason));
    });
}

async function launch(cwd: string, args: string[], launchInfo: LaunchInfo, platformInfo: PlatformInformation, options: Options, monoResolver: IMonoResolver): Promise<LaunchResult> {
    if (options.useEditorFormattingSettings) {
        let globalConfig = vscode.workspace.getConfiguration('', null);
        let csharpConfig = vscode.workspace.getConfiguration('[csharp]', null);

        args.push(`formattingOptions:useTabs=${!getConfigurationValue(globalConfig, csharpConfig, 'editor.insertSpaces', true)}`);
        args.push(`formattingOptions:tabSize=${getConfigurationValue(globalConfig, csharpConfig, 'editor.tabSize', 4)}`);
        args.push(`formattingOptions:indentationSize=${getConfigurationValue(globalConfig, csharpConfig, 'editor.tabSize', 4)}`);
    }

    if (platformInfo.isWindows()) {
        return launchWindows(launchInfo.LaunchPath, cwd, args);
    }

    let monoInfo = await monoResolver.getGlobalMonoInfo(options);

    if (monoInfo) {
        const launchPath = launchInfo.MonoLaunchPath || launchInfo.LaunchPath;
        let childEnv = monoInfo.env;
        return {
            ...launchNixMono(launchPath, cwd, args, childEnv, options.waitForDebugger),
            monoVersion: monoInfo.version,
            monoPath: monoInfo.path
        };
    }
    else {
        return launchNix(launchInfo.LaunchPath, cwd, args);
    }
}

function getConfigurationValue(globalConfig: vscode.WorkspaceConfiguration, csharpConfig: vscode.WorkspaceConfiguration,
    configurationPath: string, defaultValue: any): any {

    if (csharpConfig[configurationPath] != undefined) {
        return csharpConfig[configurationPath];
    }

    return globalConfig.get(configurationPath, defaultValue);
}

function launchWindows(launchPath: string, cwd: string, args: string[]): LaunchResult {
    function escapeIfNeeded(arg: string) {
        const hasSpaceWithoutQuotes = /^[^"].* .*[^"]/;
        return hasSpaceWithoutQuotes.test(arg)
            ? `"${arg}"`
            : arg.replace("&", "^&");
    }

    let argsCopy = args.slice(0); // create copy of args
    argsCopy.unshift(launchPath);
    argsCopy = [[
        '/s',
        '/c',
        '"' + argsCopy.map(escapeIfNeeded).join(' ') + '"'
    ].join(' ')];

    let process = spawn('cmd', argsCopy, {
        windowsVerbatimArguments: true,
        detached: false,
        cwd: cwd
    });

    return {
        process,
        command: launchPath,
    };
}

function launchNix(launchPath: string, cwd: string, args: string[]): LaunchResult {
    let process = spawn(launchPath, args, {
        detached: false,
        cwd: cwd
    });

    return {
        process,
        command: launchPath
    };
}

function launchNixMono(launchPath: string, cwd: string, args: string[], environment: NodeJS.ProcessEnv, useDebugger: boolean): LaunchResult {
    let argsCopy = args.slice(0); // create copy of details args
    argsCopy.unshift(launchPath);
    argsCopy.unshift("--assembly-loader=strict");

    if (useDebugger) {
        argsCopy.unshift("--debug");
        argsCopy.unshift("--debugger-agent=transport=dt_socket,server=y,address=127.0.0.1:55555");
    }

    let process = spawn('mono', argsCopy, {
        detached: false,
        cwd: cwd,
        env: environment
    });

    return {
        process,
        command: launchPath
    };
}

