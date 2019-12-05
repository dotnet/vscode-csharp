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
import { ShowOmniSharpChannel, CommandDotNetRestoreStart, CommandDotNetRestoreProgress, CommandDotNetRestoreSucceeded, CommandDotNetRestoreFailed } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import { PlatformInformation } from '../platform';
import CompositeDisposable from '../CompositeDisposable';
import OptionProvider from '../observers/OptionProvider';
import reportIssue from './reportIssue';
import { IMonoResolver } from '../constants/IMonoResolver';
import { getDotnetInfo } from '../utils/getDotnetInfo';

export default function registerCommands(server: OmniSharpServer, platformInfo: PlatformInformation, eventStream: EventStream, optionProvider: OptionProvider, monoResolver: IMonoResolver, packageJSON: any, extensionPath: string): CompositeDisposable {
    let disposable = new CompositeDisposable();
    disposable.add(vscode.commands.registerCommand('o.restart', () => restartOmniSharp(server)));
    disposable.add(vscode.commands.registerCommand('o.pickProjectAndStart', async () => pickProjectAndStart(server, optionProvider)));
    disposable.add(vscode.commands.registerCommand('o.showOutput', () => eventStream.post(new ShowOmniSharpChannel())));
    disposable.add(vscode.commands.registerCommand('dotnet.restore.project', async () => pickProjectAndDotnetRestore(server, eventStream)));
    disposable.add(vscode.commands.registerCommand('dotnet.restore.all', async () => dotnetRestoreAllProjects(server, eventStream)));

    disposable.add(vscode.commands.registerCommand('o.reanalyze.allProjects', async () => reAnalyzeAllProjects(server, eventStream)));
    disposable.add(vscode.commands.registerCommand('o.reanalyze.currentProject', async () => reAnalyzeCurrentProject(server, eventStream)));

    // register empty handler for csharp.installDebugger
    // running the command activates the extension, which is all we need for installation to kickoff
    disposable.add(vscode.commands.registerCommand('csharp.downloadDebugger', () => { }));

    // register process picker for attach
    let attachItemsProvider = DotNetAttachItemsProviderFactory.Get();
    let attacher = new AttachPicker(attachItemsProvider);
    disposable.add(vscode.commands.registerCommand('csharp.listProcess', async () => attacher.ShowAttachEntries()));

    // Register command for generating tasks.json and launch.json assets.
    disposable.add(vscode.commands.registerCommand('dotnet.generateAssets', async (selectedIndex) => generateAssets(server, selectedIndex)));

    // Register command for remote process picker for attach
    disposable.add(vscode.commands.registerCommand('csharp.listRemoteProcess', async (args) => RemoteAttachPicker.ShowAttachEntries(args, platformInfo)));

    // Register command for adapter executable command.
    disposable.add(vscode.commands.registerCommand('csharp.coreclrAdapterExecutableCommand', async (args) => getAdapterExecutionCommand(platformInfo, eventStream, packageJSON, extensionPath)));
    disposable.add(vscode.commands.registerCommand('csharp.clrAdapterExecutableCommand', async (args) => getAdapterExecutionCommand(platformInfo, eventStream, packageJSON, extensionPath)));
    disposable.add(vscode.commands.registerCommand('csharp.reportIssue', async () => reportIssue(vscode, eventStream, getDotnetInfo, platformInfo.isValidPlatformForMono(), optionProvider.GetLatestOptions(), monoResolver)));

    return new CompositeDisposable(disposable);
}

function restartOmniSharp(server: OmniSharpServer) {
    if (server.isRunning()) {
        server.restart();
    }
    else {
        server.autoStart('');
    }
}

async function pickProjectAndStart(server: OmniSharpServer, optionProvider: OptionProvider): Promise<void> {
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

async function pickProjectAndDotnetRestore(server: OmniSharpServer, eventStream: EventStream): Promise<void> {
    let descriptors = await getProjectDescriptors(server);
    eventStream.post(new CommandDotNetRestoreStart());
    let commands = await Promise.all(projectsToCommands(descriptors, eventStream));
    let command = await vscode.window.showQuickPick(commands);
    if (command) {
        return command.execute();
    }
}

async function reAnalyzeAllProjects(server: OmniSharpServer, eventStream: EventStream): Promise<void> {
    await serverUtils.reAnalyze(server, {});
}

async function reAnalyzeCurrentProject(server: OmniSharpServer, eventStream: EventStream): Promise<void> {
    await serverUtils.reAnalyze(server, {
        fileName: vscode.window.activeTextEditor.document.uri.fsPath
    });
}

async function dotnetRestoreAllProjects(server: OmniSharpServer, eventStream: EventStream): Promise<void> {
    let descriptors = await getProjectDescriptors(server);
    eventStream.post(new CommandDotNetRestoreStart());
    for (let descriptor of descriptors) {
        await dotnetRestore(descriptor.Directory, eventStream);
    }
}

async function getProjectDescriptors(server: OmniSharpServer): Promise<protocol.ProjectDescriptor[]> {
    if (!server.isRunning()) {
        return Promise.reject('OmniSharp server is not running.');
    }

    let info = await serverUtils.requestWorkspaceInformation(server);
    let descriptors = protocol.getDotNetCoreProjectDescriptors(info);
    if (descriptors.length === 0) {
        return Promise.reject("No .NET Core projects found");
    }

    return descriptors;
}

export async function dotnetRestore(cwd: string, eventStream: EventStream, filePath?: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
