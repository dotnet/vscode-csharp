/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { spawn, ChildProcess } from 'child_process';
import { satisfies } from 'semver';
import { PlatformInformation } from '../platform';
import * as path from 'path';
import * as vscode from 'vscode';
import * as util from '../common';
import { Options } from './options';

export enum LaunchTargetKind {
    Solution,
    ProjectJson,
    Folder,
    Csx
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

/**
 * Returns a list of potential targets on which OmniSharp can be launched.
 * This includes `project.json` files, `*.sln` files (if any `*.csproj` files are found), and the root folder
 * (if it doesn't contain a `project.json` file, but `project.json` files exist). In addition, the root folder
 * is included if there are any `*.csproj` files present, but a `*.sln* file is not found.
 */
export function findLaunchTargets(): Thenable<LaunchTarget[]> {
    if (!vscode.workspace.rootPath) {
        return Promise.resolve([]);
    }

    const options = Options.Read();

    return vscode.workspace.findFiles(
        /*include*/ '{**/*.sln,**/*.csproj,**/project.json,**/*.csx}', 
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ options.maxProjectResults)
    .then(resources => {
        return select(resources, vscode.workspace.rootPath);
    });
}

function select(resources: vscode.Uri[], rootPath: string): LaunchTarget[] {
    // The list of launch targets is calculated like so:
    //   * If there are .csproj files, .sln files are considered as launch targets.
    //   * Any project.json file is considered a launch target.
    //   * If there is no project.json file in the root, the root as added as a launch target.
    //   * Additionally, if there are .csproj files, but no .sln file, the root is added as a launch target.
    //
    // TODO:
    //   * It should be possible to choose a .csproj as a launch target
    //   * It should be possible to choose a .sln file even when no .csproj files are found 
    //     within the root.

    if (!Array.isArray(resources)) {
        return [];
    }

    let targets: LaunchTarget[] = [],
        hasCsProjFiles = false,
        hasSlnFile = false,
        hasProjectJson = false,
        hasProjectJsonAtRoot = false,
        hasCSX = false;

    hasCsProjFiles = resources.some(isCSharpProject);

    resources.forEach(resource => {
        // Add .sln files if there are .csproj files
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
            hasProjectJsonAtRoot = hasProjectJsonAtRoot || dirname === rootPath;

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
    });

    // Add the root folder under the following circumstances:
    // * If there are .csproj files, but no .sln file, and none in the root.
    // * If there are project.json files, but none in the root.
    if ((hasCsProjFiles && !hasSlnFile) || (hasProjectJson && !hasProjectJsonAtRoot)) {
        targets.push({
            label: path.basename(rootPath),
            description: '',
            target: rootPath,
            directory: rootPath,
            kind: LaunchTargetKind.Folder
        });
    }

    // if we noticed any CSX file(s), add a single CSX-specific target pointing at the root folder
    if (hasCSX) {
        targets.push({
            label: "CSX",
            description: path.basename(rootPath),
            target: rootPath,
            directory: rootPath,
            kind: LaunchTargetKind.Csx
        });
    }

    return targets.sort((a, b) => a.directory.localeCompare(b.directory));
}

function isCSharpProject(resource: vscode.Uri): boolean {
    return /\.csproj$/i.test(resource.fsPath);
}

function isSolution(resource: vscode.Uri): boolean {
    return /\.sln$/i.test(resource.fsPath);
}

function isProjectJson(resource: vscode.Uri): boolean {
    return /\project.json$/i.test(resource.fsPath);
}

function isCsx(resource: vscode.Uri): boolean {
    return /\.csx$/i.test(resource.fsPath);
}

export interface LaunchResult {
    process: ChildProcess;
    command: string;
    usingMono: boolean;
}

export function launchOmniSharp(cwd: string, args: string[]): Promise<LaunchResult> {
    return new Promise<LaunchResult>((resolve, reject) => {
        launch(cwd, args)
            .then(result => {
                // async error - when target not not ENEOT
                result.process.on('error', err => {
                    reject(err);
                });

                // success after a short freeing event loop
                setTimeout(function () {
                    resolve(result);
                }, 0);
            });
    });
}

function launch(cwd: string, args: string[]): Promise<LaunchResult> {
    return PlatformInformation.GetCurrent().then(platformInfo => {
        const options = Options.Read();

        if (options.useEditorFormattingSettings) 
        {
            let globalConfig = vscode.workspace.getConfiguration();
            let csharpConfig = vscode.workspace.getConfiguration('[csharp]');

            args.push(`formattingOptions:useTabs=${!getConfigurationValue(globalConfig, csharpConfig, 'editor.insertSpaces', true)}`);
            args.push(`formattingOptions:tabSize=${getConfigurationValue(globalConfig, csharpConfig, 'editor.tabSize', 4)}`);
            args.push(`formattingOptions:indentationSize=${getConfigurationValue(globalConfig, csharpConfig, 'editor.tabSize', 4)}`);
        }

        if (options.path && options.useMono) {
            return launchNixMono(options.path, cwd, args);
        }

        const launchPath = options.path || getLaunchPath(platformInfo);

        if (platformInfo.isWindows()) {
            return launchWindows(launchPath, cwd, args);
        }
        else {
            return launchNix(launchPath, cwd, args);
        }
    });
}

function getConfigurationValue(globalConfig: vscode.WorkspaceConfiguration, csharpConfig: vscode.WorkspaceConfiguration,
    configurationPath: string, defaultValue: any): any {
    
    if (csharpConfig[configurationPath] != undefined) {
        return csharpConfig[configurationPath];
    }
    
    return globalConfig.get(configurationPath, defaultValue);
}

function getLaunchPath(platformInfo: PlatformInformation): string {
    const binPath = path.resolve(util.getExtensionPath(), '.omnisharp');

    return platformInfo.isWindows()
        ? path.join(binPath, 'OmniSharp.exe')
        : path.join(binPath, 'run');
}

function launchWindows(launchPath: string, cwd: string, args: string[]): LaunchResult {
    function escapeIfNeeded(arg: string) {
        const hasSpaceWithoutQuotes = /^[^"].* .*[^"]/;
        return hasSpaceWithoutQuotes.test(arg)
            ? `"${arg}"`
            : arg.replace("&","^&");
    }

    let argsCopy = args.slice(0); // create copy of args
    argsCopy.unshift(launchPath);
    argsCopy = [[
        '/s',
        '/c',
        '"' + argsCopy.map(escapeIfNeeded).join(' ') + '"'
    ].join(' ')];

    let process = spawn('cmd', argsCopy, <any>{
        windowsVerbatimArguments: true,
        detached: false,
        cwd: cwd
    });

    return {
        process,
        command: launchPath,
        usingMono: false
    };
}

function launchNix(launchPath: string, cwd: string, args: string[]): LaunchResult {
    let process = spawn(launchPath, args, {
        detached: false,
        cwd: cwd
    });

    return {
        process,
        command: launchPath,
        usingMono: true
    };
}

function launchNixMono(launchPath: string, cwd: string, args: string[]): Promise<LaunchResult> {
    return canLaunchMono()
        .then(() => {
            let argsCopy = args.slice(0); // create copy of details args
            argsCopy.unshift("--assembly-loader=strict");
            argsCopy.unshift(launchPath);

            let process = spawn('mono', argsCopy, {
                detached: false,
                cwd: cwd
            });

            return {
                process,
                command: launchPath,
                usingMono: true
            };
        });
}

function canLaunchMono(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        hasMono('>=5.2.0').then(success => {
            if (success) {
                resolve();
            }
            else {
                reject(new Error('Cannot start Omnisharp because Mono version >=5.2.0 is required.'));
            }
        });
    });
}

export function hasMono(range?: string): Promise<boolean> {
    const versionRegexp = /(\d+\.\d+\.\d+)/;

    return new Promise<boolean>((resolve, reject) => {
        let childprocess: ChildProcess;
        try {
            childprocess = spawn('mono', ['--version']);
        }
        catch (e) {
            return resolve(false);
        }

        childprocess.on('error', function (err: any) {
            resolve(false);
        });

        let stdout = '';
        childprocess.stdout.on('data', (data: NodeBuffer) => {
            stdout += data.toString();
        });

        childprocess.stdout.on('close', () => {
            let match = versionRegexp.exec(stdout),
                ret: boolean;

            if (!match) {
                ret = false;
            }
            else if (!range) {
                ret = true;
            }
            else {
                ret = satisfies(match[1], range);
            }

            resolve(ret);
        });
    });
}