/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../omnisharp/server';
import * as serverUtils from '../omnisharp/utils';
import { findLaunchTargets } from '../omnisharp/launcher';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as protocol from '../omnisharp/protocol';
import * as vscode from 'vscode';
import { DotNetAttachItemsProviderFactory, AttachPicker, RemoteAttachPicker } from './processPicker';
import { generateAssets } from '../assets';
import { getAdapterExecutionCommand } from '../coreclr-debug/activate';
import { CommandShowOutput, CommandDotNetRestoreStart, CommandDotNetRestoreProgress, CommandDotNetRestoreSucceeded, CommandDotNetRestoreFailed } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import { PlatformInformation } from '../platform';
import CompositeDisposable from '../CompositeDisposable';
import OptionProvider from '../observers/OptionProvider';

export default function registerCommands(server: OmniSharpServer, platformInfo: PlatformInformation, eventStream: EventStream, optionProvider: OptionProvider): CompositeDisposable {
    let d1 = vscode.commands.registerCommand('o.restart', () => restartOmniSharp(server));
    let d2 = vscode.commands.registerCommand('o.pickProjectAndStart', async () => pickProjectAndStart(server, optionProvider));
    let d3 = vscode.commands.registerCommand('o.showOutput', () => eventStream.post(new CommandShowOutput()));
    let d4 = vscode.commands.registerCommand('dotnet.restore', fileName => {
        if (fileName) {
            dotnetRestoreForProject(server, fileName, eventStream);
        }
        else {
            dotnetRestoreAllProjects(server, eventStream);
        }
    }); 

    // register empty handler for csharp.installDebugger
    // running the command activates the extension, which is all we need for installation to kickoff
    let d5 = vscode.commands.registerCommand('csharp.downloadDebugger', () => { });

    // register process picker for attach
    let attachItemsProvider = DotNetAttachItemsProviderFactory.Get();
    let attacher = new AttachPicker(attachItemsProvider);
    let d6 = vscode.commands.registerCommand('csharp.listProcess', async () => attacher.ShowAttachEntries());

    // Register command for generating tasks.json and launch.json assets.
    let d7 = vscode.commands.registerCommand('dotnet.generateAssets', async () => generateAssets(server));

    // Register command for remote process picker for attach
    let d8 = vscode.commands.registerCommand('csharp.listRemoteProcess', async (args) => RemoteAttachPicker.ShowAttachEntries(args, platformInfo));

    // Register command for adapter executable command.
    let d9 = vscode.commands.registerCommand('csharp.coreclrAdapterExecutableCommand', async (args) => getAdapterExecutionCommand(platformInfo, eventStream));
    let d10 = vscode.commands.registerCommand('csharp.clrAdapterExecutableCommand', async (args) => getAdapterExecutionCommand(platformInfo, eventStream));

    return new CompositeDisposable(d1, d2, d3, d4, d5, d6, d7, d8, d9, d10);
}

function restartOmniSharp(server: OmniSharpServer) {
    if (server.isRunning()) {
        server.restart();
    }
    else {
        server.autoStart('');
    }
}

async function pickProjectAndStart(server: OmniSharpServer, optionProvider: OptionProvider) {
    let options = optionProvider.GetLatestOptions();
    return findLaunchTargets(options).then(targets => {

        let currentPath = server.getSolutionPathOrFolder();
        if (currentPath) {
            for (let target of targets) {
                if (target.target === currentPath) {
                    target.label = `\u2713 ${target.label}`;
                }
            }
        }

        return vscode.window.showQuickPick(targets, {
            matchOnDescription: true,
            placeHolder: `Select 1 of ${targets.length} projects`
        }).then(async launchTarget => {
            if (launchTarget) {
                return server.restart(launchTarget);
            }
        });
    });
}

interface Command {
    label: string;
    description: string;
    execute(): Thenable<void>;
}

function projectsToCommands(projects: protocol.ProjectDescriptor[], eventStream: EventStream): Promise<Command>[] {
    return projects.map(async project => {
        let projectDirectory = project.Directory;

        return new Promise<Command>((resolve, reject) => {
            fs.lstat(projectDirectory, (err, stats) => {
                if (err) {
                    return reject(err);
                }

                if (stats.isFile()) {
                    projectDirectory = path.dirname(projectDirectory);
                }

                resolve({
                    label: `dotnet restore - (${project.Name || path.basename(project.Directory)})`,
                    description: projectDirectory,
                    async execute() {
                        return dotnetRestore(projectDirectory, eventStream);
                    }
                });
            });
        });
    });
}

export async function dotnetRestoreAllProjects(server: OmniSharpServer, eventStream: EventStream): Promise<void> {

    if (!server.isRunning()) {
        return Promise.reject('OmniSharp server is not running.');
    }

    return serverUtils.requestWorkspaceInformation(server).then(async info => {

        let descriptors = protocol.getDotNetCoreProjectDescriptors(info);

        if (descriptors.length === 0) {
            return Promise.reject("No .NET Core projects found");
        }

        let commandPromises = projectsToCommands(descriptors, eventStream);

        return Promise.all(commandPromises).then(commands => {
            return vscode.window.showQuickPick(commands);
        }).then(command => {
            if (command) {
                return command.execute();
            }
        });
    });
}

export async function dotnetRestoreForProject(server: OmniSharpServer, filePath: string, eventStream: EventStream) {

    if (!server.isRunning()) {
        return Promise.reject('OmniSharp server is not running.');
    }

    return serverUtils.requestWorkspaceInformation(server).then(async info => {

        let descriptors = protocol.getDotNetCoreProjectDescriptors(info);

        if (descriptors.length === 0) {
            return Promise.reject("No .NET Core projects found");
        }

        for (let descriptor of descriptors) {
            if (descriptor.FilePath === filePath) {
                return dotnetRestore(descriptor.Directory, eventStream, filePath);
            }
        }
    });
}

async function dotnetRestore(cwd: string, eventStream: EventStream, filePath?: string) {
    return new Promise<void>((resolve, reject) => {
        eventStream.post(new CommandDotNetRestoreStart());

        let cmd = 'dotnet';
        let args = ['restore'];

        if (filePath) {
            args.push(filePath);
        }

        let dotnet = cp.spawn(cmd, args, { cwd: cwd, env: process.env });

        function handleData(stream: NodeJS.ReadableStream) {
            stream.on('data', chunk => {
                eventStream.post(new CommandDotNetRestoreProgress(chunk.toString()));
            });

            stream.on('err', err => {
                eventStream.post(new CommandDotNetRestoreProgress(`ERROR: ${err}`));
            });
        }

        handleData(dotnet.stdout);
        handleData(dotnet.stderr);

        dotnet.on('close', (code, signal) => {
            eventStream.post(new CommandDotNetRestoreSucceeded(`Done: ${code}.`));
            resolve();
        });

        dotnet.on('error', err => {
            eventStream.post(new CommandDotNetRestoreFailed(`ERROR: ${err}`));
            reject(err);
        });
    });
}
