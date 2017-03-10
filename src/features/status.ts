/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import {OmniSharpServer} from '../omnisharp/server';
import {dotnetRestoreForProject} from './commands';
import {basename} from 'path';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from '../omnisharp/utils';

const debounce = require('lodash.debounce');

export default function reportStatus(server: OmniSharpServer) {
    return vscode.Disposable.from(
        reportServerStatus(server),
        forwardOutput(server),
        reportDocumentStatus(server));
}

// --- document status

let defaultSelector: vscode.DocumentSelector = [
    'csharp', // c#-files OR
    { pattern: '**/project.json' }, // project.json-files OR
    { pattern: '**/*.sln' }, // any solution file OR
    { pattern: '**/*.csproj' }, // an csproj file
    { pattern: '**/*.csx' } // C# script
];

class Status {

    selector: vscode.DocumentSelector;
    text: string;
    command: string;
    color: string;

    constructor(selector: vscode.DocumentSelector) {
        this.selector = selector;
    }
}

export function reportDocumentStatus(server: OmniSharpServer): vscode.Disposable {

    let disposables: vscode.Disposable[] = [];
    let localDisposables: vscode.Disposable[];

    let entry = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Number.MIN_VALUE);
    let defaultStatus = new Status(defaultSelector);
    let projectStatus: Status;

    function render() {

        if (!vscode.window.activeTextEditor) {
            entry.hide();
            return;
        }

        let document = vscode.window.activeTextEditor.document;
        let status: Status;

        if (projectStatus && vscode.languages.match(projectStatus.selector, document)) {
            status = projectStatus;
        } else if (defaultStatus.text && vscode.languages.match(defaultStatus.selector, document)) {
            status = defaultStatus;
        }

        if (status) {
            entry.text = status.text;
            entry.command = status.command;
            entry.color = status.color;
            entry.show();
            return;
        }

        entry.hide();
    }

    disposables.push(vscode.window.onDidChangeActiveTextEditor(render));

    disposables.push(server.onServerError(err => {
        defaultStatus.text = '$(flame) Error starting OmniSharp';
        defaultStatus.command = 'o.showOutput';
        defaultStatus.color = '';
        render();
    }));

    disposables.push(server.onMultipleLaunchTargets(targets => {
        defaultStatus.text = '$(flame) Select project';
        defaultStatus.command = 'o.pickProjectAndStart';
        defaultStatus.color = 'rgb(90, 218, 90)';
        render();
    }));

    disposables.push(server.onBeforeServerInstall(() => {
        defaultStatus.text = '$(flame) Installing OmniSharp...';
        defaultStatus.command = 'o.showOutput';
        defaultStatus.color = '';
        render();
    }));

    disposables.push(server.onBeforeServerStart(path => {
        defaultStatus.text = '$(flame) Starting...';
        defaultStatus.command = 'o.showOutput';
        defaultStatus.color = '';
        render();
    }));

    disposables.push(server.onServerStop(() => {
        projectStatus = undefined;
        defaultStatus.text = undefined;

        if (localDisposables) {
            vscode.Disposable.from(...localDisposables).dispose();
        }
        
        localDisposables = undefined;
    }));

    disposables.push(server.onServerStart(path => {
        localDisposables = [];

        defaultStatus.text = '$(flame) Running';
        defaultStatus.command = 'o.pickProjectAndStart';
        defaultStatus.color = '';
        render();

        function updateProjectInfo() {
            serverUtils.requestWorkspaceInformation(server).then(info => {

                interface Project {
                    Path: string;
                    SourceFiles: string[];
                }

                let fileNames: vscode.DocumentSelector[] = [];
                let label: string;

                function addProjectFileNames(project: Project) {
                    fileNames.push({ pattern: project.Path });

                    if (project.SourceFiles) {
                        for (let sourceFile of project.SourceFiles) {
                            fileNames.push({ pattern: sourceFile });
                        }
                    }
                }

                function addDnxOrDotNetProjects(projects: Project[]) {
                    let count = 0;

                    for (let project of projects) {
                        count += 1;
                        addProjectFileNames(project);
                    }

                    if (!label) {
                        if (count === 1) {
                            label = basename(projects[0].Path); //workspace.getRelativePath(info.Dnx.Projects[0].Path);
                        }
                        else {
                            label = `${count} projects`;
                        }
                    }
                }

                // show sln-file if applicable
                if (info.MsBuild && info.MsBuild.SolutionPath) {
                    label = basename(info.MsBuild.SolutionPath); //workspace.getRelativePath(info.MsBuild.SolutionPath);
                    fileNames.push({ pattern: info.MsBuild.SolutionPath });

                    for (let project of info.MsBuild.Projects) {
                        addProjectFileNames(project);
                    }
                }

                // show .NET Core projects if applicable
                if (info.DotNet) {
                    addDnxOrDotNetProjects(info.DotNet.Projects);
                }

                // set project info
                projectStatus = new Status(fileNames);
                projectStatus.text = '$(flame) ' + label;
                projectStatus.command = 'o.pickProjectAndStart';

                // default is to change project
                defaultStatus.text = '$(flame) Switch projects';
                defaultStatus.command = 'o.pickProjectAndStart';
                render();
            });
        }

        // Don't allow the same request to slam the server within a "short" window
        let debouncedUpdateProjectInfo = debounce(updateProjectInfo, 1500, { leading: true });
        localDisposables.push(server.onProjectAdded(debouncedUpdateProjectInfo));
        localDisposables.push(server.onProjectChange(debouncedUpdateProjectInfo));
        localDisposables.push(server.onProjectRemoved(debouncedUpdateProjectInfo));
    }));

    return vscode.Disposable.from(...disposables);
}


// ---- server status

export function reportServerStatus(server: OmniSharpServer): vscode.Disposable{

    function appendLine(value: string = '') {
        server.getChannel().appendLine(value);
    }

    let d0 = server.onServerError(err => {
        appendLine('[ERROR] ' + err);
    });

    let d1 = server.onError(message => {
        if (message.FileName) {
            appendLine(`${message.FileName}(${message.Line},${message.Column})`);
        }
        appendLine(message.Text);
        appendLine();
        showMessageSoon();
    });

    let d2 = server.onMsBuildProjectDiagnostics(message => {

        function asErrorMessage(message: protocol.MSBuildDiagnosticsMessage) {
            let value = `${message.FileName}(${message.StartLine},${message.StartColumn}): Error: ${message.Text}`;
            appendLine(value);
        }

        function asWarningMessage(message: protocol.MSBuildDiagnosticsMessage) {
            let value = `${message.FileName}(${message.StartLine},${message.StartColumn}): Warning: ${message.Text}`;
            appendLine(value);
        }

        if (message.Errors.length > 0 || message.Warnings.length > 0) {
            appendLine(message.FileName);
            message.Errors.forEach(error => asErrorMessage);
            message.Warnings.forEach(warning => asWarningMessage);
            appendLine();

            if (message.Errors.length > 0) {
                showMessageSoon();
            }
        }
    });

    let d3 = server.onUnresolvedDependencies(message => {
        let csharpConfig = vscode.workspace.getConfiguration('csharp');
        if (!csharpConfig.get<boolean>('suppressDotnetRestoreNotification')) {
            let info = `There are unresolved dependencies from '${vscode.workspace.asRelativePath(message.FileName) }'. Please execute the restore command to continue.`;

            return vscode.window.showInformationMessage(info, 'Restore').then(value => {
                if (value) {
                    dotnetRestoreForProject(server, message.FileName);
                }
            });
        }
    });

    return vscode.Disposable.from(d0, d1, d2, d3);
}

// show user message
let _messageHandle: NodeJS.Timer;
function showMessageSoon() {
    clearTimeout(_messageHandle);
    _messageHandle = setTimeout(function() {

        let message = "Some projects have trouble loading. Please review the output for more details.";
        vscode.window.showWarningMessage(message, { title: "Show Output", command: 'o.showOutput' }).then(value => {
            if (value) {
                vscode.commands.executeCommand(value.command);
            }
        });
    }, 1500);
}

// --- mirror output in channel

function forwardOutput(server: OmniSharpServer) {

    const logChannel = server.getChannel();

    function forward(message: string) {
        logChannel.append(message);
    }

    return vscode.Disposable.from(
        server.onStderr(forward));
}