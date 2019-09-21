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
import setNextStatement from '../coreclr-debug/setNextStatement';
import { IMonoResolver } from '../constants/IMonoResolver';
import { getDotnetInfo } from '../utils/getDotnetInfo';
import { WorkspaceEdit } from 'vscode';

export default function registerCommands(server: OmniSharpServer, platformInfo: PlatformInformation, eventStream: EventStream, optionProvider: OptionProvider, monoResolver: IMonoResolver, packageJSON: any, extensionPath: string): CompositeDisposable {
    let disposable = new CompositeDisposable();
    disposable.add(vscode.commands.registerCommand('o.restart', () => restartOmniSharp(server)));
    disposable.add(vscode.commands.registerCommand('o.pickProjectAndStart', async () => pickProjectAndStart(server, optionProvider)));
    disposable.add(vscode.commands.registerCommand('o.showOutput', () => eventStream.post(new ShowOmniSharpChannel())));

    // Todo these should really open new menu that lists correct options...
    disposable.add(vscode.commands.registerCommand('o.fixAll.solution', async () => fixAllTemporary(server, protocol.FixAllScope.Solution)));
    disposable.add(vscode.commands.registerCommand('o.fixAll.project', async () => fixAllTemporary(server, protocol.FixAllScope.Project)));
    disposable.add(vscode.commands.registerCommand('o.fixAll.document', async () => fixAllTemporary(server, protocol.FixAllScope.Document)));

    disposable.add(vscode.commands.registerCommand('dotnet.restore.project', async () => pickProjectAndDotnetRestore(server, eventStream)));
    disposable.add(vscode.commands.registerCommand('dotnet.restore.all', async () => dotnetRestoreAllProjects(server, eventStream)));

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

    disposable.add(vscode.commands.registerCommand('csharp.setNextStatement', async () => setNextStatement()));
 
    // Register command for adapter executable command.
    disposable.add(vscode.commands.registerCommand('csharp.coreclrAdapterExecutableCommand', async (args) => getAdapterExecutionCommand(platformInfo, eventStream, packageJSON, extensionPath)));
    disposable.add(vscode.commands.registerCommand('csharp.clrAdapterExecutableCommand', async (args) => getAdapterExecutionCommand(platformInfo, eventStream, packageJSON, extensionPath)));
    disposable.add(vscode.commands.registerCommand('csharp.reportIssue', async () => reportIssue(vscode, eventStream, getDotnetInfo, platformInfo.isValidPlatformForMono(), optionProvider.GetLatestOptions(), monoResolver)));

    return new CompositeDisposable(disposable);
}

// This should be replaced with method that opens menu etc.
async function fixAllTemporary(server: OmniSharpServer, scope: protocol.FixAllScope): Promise<void> {
    let availableFixes = await serverUtils.getFixAll(server, { FileName: vscode.window.activeTextEditor.document.fileName, Scope: scope });
    let targets = availableFixes.Items.map(x => `${x.Id}: ${x.Message}`);

    return vscode.window.showQuickPick(targets, {
        matchOnDescription: true,
        placeHolder: `Select fix all action`
    }).then(async selectedAction => {
        if (selectedAction === undefined) {
            return;
        }

        // action comes in form like "CS0000: Description message"
        let actionTokens = selectedAction.split(":");

        let response = await serverUtils.runFixAll(server, { FileName: vscode.window.activeTextEditor.document.fileName, Scope: scope, FixAllFilter: [{ Id: actionTokens[0], Message: actionTokens[1] }] });

        response.Changes.forEach(change => {
            const uri = vscode.Uri.file(change.FileName);

            let edits: WorkspaceEdit = new WorkspaceEdit();
            change.Changes.forEach(change => {
                edits.replace(uri,
                    new vscode.Range(change.StartLine - 1, change.StartColumn - 1, change.EndLine - 1, change.EndColumn - 1),
                    change.NewText);
            });

            vscode.workspace.applyEdit(edits);
        });
    });
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
