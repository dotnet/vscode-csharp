/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {spawn, ChildProcess} from 'child_process';
import {satisfies} from 'semver';
import {Platform, getCurrentPlatform} from '../platform';
import * as omnisharp from './omnisharp';
import * as path from 'path';
import * as vscode from 'vscode';

export enum LaunchTargetKind {
    Solution,
    ProjectJson,
    Folder
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

export function getDefaultFlavor(kind: LaunchTargetKind) {
    // Default to desktop (for Windows) or mono (for OSX/Linux) for solution files; otherwise, CoreCLR.
    if (kind === LaunchTargetKind.Solution) {
        if (process.platform === 'win32') {
            return omnisharp.Flavor.Desktop;
        }

        return omnisharp.Flavor.Mono;
    }

    return omnisharp.Flavor.CoreCLR;
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

    return vscode.workspace.findFiles(
        /*include*/ '{**/*.sln,**/*.csproj,**/project.json}', 
        /*exclude*/ '{**/node_modules/**,**/.git/**,**/bower_components/**}',
        /*maxResults*/ 100)
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
        hasProjectJsonAtRoot = false;

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

export interface LaunchDetails {
    serverPath: string;
    flavor: omnisharp.Flavor;
    cwd: string;
    args: string[];
}

export interface LaunchResult {
    process: ChildProcess;
    command: string;
    usingMono: boolean;
}

export function launchOmniSharp(details: LaunchDetails): Promise<LaunchResult> {
    return new Promise<LaunchResult>((resolve, reject) => {
        launch(details).then(result => {
            // async error - when target not not ENEOT
            result.process.on('error', reject);

            // success after a short freeing event loop
            setTimeout(function () {
                resolve(result);
            }, 0);
        });
    });
}

function launch(details: LaunchDetails): Promise<LaunchResult> {
    return getCurrentPlatform().then(platform => {
        if (platform === Platform.Windows) {
            return launchWindows(details);
        }
        else {
            return launchNix(details);
        }
    });
}

function launchWindows(details: LaunchDetails): Promise<LaunchResult> {
    function escapeIfNeeded(arg: string) {
        const hasSpaceWithoutQuotes = /^[^"].* .*[^"]/;
        return hasSpaceWithoutQuotes.test(arg)
            ? `"${arg}"`
            : arg;
    }

    let args = details.args.slice(0); // create copy of details.args
    args.unshift(details.serverPath);
    args = [[
        '/s',
        '/c',
        '"' + args.map(escapeIfNeeded).join(' ') + '"'
    ].join(' ')];

    let process = spawn('cmd', args, <any>{
        windowsVerbatimArguments: true,
        detached: false,
        cwd: details.cwd
    });

    return Promise.resolve({
        process,
        command: details.serverPath,
        usingMono: false
    });
}

function launchNix(details: LaunchDetails): Promise<LaunchResult> {
    if (details.flavor === omnisharp.Flavor.CoreCLR) {
        return launchNixCoreCLR(details);
    }
    else if (details.flavor === omnisharp.Flavor.Mono) {
        return launchNixMono(details);
    }
    else {
        throw new Error(`Unexpected OmniSharp flavor: ${details.flavor}`);
    }
}

function launchNixCoreCLR(details: LaunchDetails): Promise<LaunchResult> {
    let process = spawn(details.serverPath, details.args, {
        detached: false,
        cwd: details.cwd
    });

    return Promise.resolve({
        process,
        command: details.serverPath,
        usingMono: false
    });
}

function launchNixMono(details: LaunchDetails): Promise<LaunchResult> {
    return canLaunchMono().then(() => {
        let args = details.args.slice(0); // create copy of details.args
        args.unshift(details.serverPath);

        let process = spawn('mono', args, {
            detached: false,
            cwd: details.cwd
        });

        return {
            process,
            command: details.serverPath,
            usingMono: true
        };
    });
}

function canLaunchMono(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        hasMono('>=4.0.1').then(success => {
            if (success) {
                resolve();
            }
            else {
                reject(new Error('Cannot start Omnisharp because Mono version >=4.0.1 is required.'));
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