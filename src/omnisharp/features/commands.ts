/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OmniSharpServer } from '../server';
import * as serverUtils from '../utils';
import { findLaunchTargets } from '../launcher';
import { LaunchTarget } from '../../shared/launchTarget';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as protocol from '../protocol';
import * as vscode from 'vscode';
import { generateAssets } from '../../shared/assets';
import {
    ShowOmniSharpChannel,
    CommandDotNetRestoreStart,
    CommandDotNetRestoreProgress,
    CommandDotNetRestoreSucceeded,
    CommandDotNetRestoreFailed,
} from '../loggingEvents';
import { EventStream } from '../../eventStream';
import { PlatformInformation } from '../../shared/platform';
import CompositeDisposable from '../../compositeDisposable';
import reportIssue from '../../shared/reportIssue';
import { IHostExecutableResolver } from '../../shared/constants/IHostExecutableResolver';
import { getDotnetInfo } from '../../shared/utils/getDotnetInfo';
import { IWorkspaceDebugInformationProvider } from '../../shared/IWorkspaceDebugInformationProvider';

export default function registerCommands(
    context: vscode.ExtensionContext,
    server: OmniSharpServer,
    platformInfo: PlatformInformation,
    eventStream: EventStream,
    monoResolver: IHostExecutableResolver,
    dotnetResolver: IHostExecutableResolver,
    workspaceInformationProvider: IWorkspaceDebugInformationProvider
): CompositeDisposable {
    const disposable = new CompositeDisposable();
    disposable.add(vscode.commands.registerCommand('o.restart', async () => restartOmniSharp(context, server)));
    disposable.add(vscode.commands.registerCommand('o.pickProjectAndStart', async () => pickProjectAndStart(server)));
    disposable.add(vscode.commands.registerCommand('o.showOutput', () => eventStream.post(new ShowOmniSharpChannel())));

    disposable.add(
        vscode.commands.registerCommand('dotnet.restore.project', async () =>
            pickProjectAndDotnetRestore(server, eventStream)
        )
    );
    disposable.add(
        vscode.commands.registerCommand('dotnet.restore.all', async () => dotnetRestoreAllProjects(server, eventStream))
    );

    disposable.add(
        vscode.commands.registerCommand('o.reanalyze.allProjects', async () => reAnalyzeAllProjects(server))
    );
    disposable.add(
        vscode.commands.registerCommand('o.reanalyze.currentProject', async () => reAnalyzeCurrentProject(server))
    );

    // Register command for generating tasks.json and launch.json assets.
    disposable.add(
        vscode.commands.registerCommand('dotnet.generateAssets', async (selectedIndex) =>
            generateAssets(workspaceInformationProvider, selectedIndex)
        )
    );

    disposable.add(
        vscode.commands.registerCommand('csharp.reportIssue', async () =>
            reportIssue(
                context.extension.packageJSON.version,
                getDotnetInfo,
                platformInfo.isValidPlatformForMono(),
                dotnetResolver,
                monoResolver
            )
        )
    );

    return new CompositeDisposable(disposable);
}

async function restartOmniSharp(context: vscode.ExtensionContext, server: OmniSharpServer) {
    if (server.isRunning()) {
        server.restart();
    } else {
        server.autoStart('');
    }
}

async function pickProjectAndStart(server: OmniSharpServer): Promise<void> {
    return findLaunchTargets().then(async (targets) => {
        const currentPath = server.getSolutionPathOrFolder();
        if (currentPath) {
            for (const target of targets) {
                if (target.target === currentPath) {
                    target.label = `\u2713 ${target.label}`;
                }
            }
        }

        return showProjectSelector(server, targets);
    });
}

export async function showProjectSelector(server: OmniSharpServer, targets: LaunchTarget[]): Promise<void> {
    const launchTarget = await vscode.window.showQuickPick(targets, {
        matchOnDescription: true,
        placeHolder: `Select 1 of ${targets.length} projects`,
    });

    if (launchTarget !== undefined) {
        return server.restart(launchTarget);
    }
}

interface Command {
    label: string;
    description: string;
    execute(): Thenable<void>;
}

function projectsToCommands(projects: protocol.ProjectDescriptor[], eventStream: EventStream): Promise<Command>[] {
    return projects.map(async (project) => {
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
                        return dotnetRestore(projectDirectory, eventStream, project.Name);
                    },
                });
            });
        });
    });
}

async function pickProjectAndDotnetRestore(server: OmniSharpServer, eventStream: EventStream): Promise<void> {
    const descriptors = await getProjectDescriptors(server);
    eventStream.post(new CommandDotNetRestoreStart());
    const commands = await Promise.all(projectsToCommands(descriptors, eventStream));
    const command = await vscode.window.showQuickPick(commands);
    if (command) {
        return command.execute();
    }
}

async function reAnalyzeAllProjects(server: OmniSharpServer): Promise<void> {
    await serverUtils.reAnalyze(server, {});
}

async function reAnalyzeCurrentProject(server: OmniSharpServer): Promise<void> {
    const activeTextEditor = vscode.window.activeTextEditor;
    if (activeTextEditor === undefined) {
        return;
    }

    await serverUtils.reAnalyze(server, {
        FileName: activeTextEditor.document.uri.fsPath,
    });
}

async function dotnetRestoreAllProjects(server: OmniSharpServer, eventStream: EventStream): Promise<void> {
    const descriptors = await getProjectDescriptors(server);
    eventStream.post(new CommandDotNetRestoreStart());
    for (const descriptor of descriptors) {
        await dotnetRestore(descriptor.Directory, eventStream, descriptor.Name);
    }
}

async function getProjectDescriptors(server: OmniSharpServer): Promise<protocol.ProjectDescriptor[]> {
    if (!server.isRunning()) {
        throw new Error('OmniSharp server is not running.');
    }

    const info = await serverUtils.requestWorkspaceInformation(server);
    const descriptors = protocol.getDotNetCoreProjectDescriptors(info);
    if (descriptors.length === 0) {
        throw new Error('No .NET Core projects found');
    }

    return descriptors;
}

export async function dotnetRestore(cwd: string, eventStream: EventStream, filePath?: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const cmd = 'dotnet';
        const args = ['restore'];

        if (filePath) {
            args.push(filePath);
        }

        const dotnet = cp.spawn(cmd, args, { cwd: cwd, env: process.env });

        function handleData(stream: NodeJS.ReadableStream) {
            stream.on('data', (chunk) => {
                eventStream.post(new CommandDotNetRestoreProgress(chunk.toString()));
            });

            stream.on('err', (err) => {
                eventStream.post(new CommandDotNetRestoreProgress(`ERROR: ${err}`));
            });
        }

        handleData(dotnet.stdout);
        handleData(dotnet.stderr);

        dotnet.on('close', (code) => {
            eventStream.post(new CommandDotNetRestoreSucceeded(`Done: ${code}.`));
            resolve();
        });

        dotnet.on('error', (err) => {
            eventStream.post(new CommandDotNetRestoreFailed(`ERROR: ${err}`));
            reject(err);
        });
    });
}
