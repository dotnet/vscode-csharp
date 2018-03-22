/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import * as ObservableEvent from "../omnisharp/loggingEvents";
import { Status } from './status';
import * as serverUtils from '../omnisharp/utils';
import { basename } from 'path';
import { OmniSharpServer } from '../omnisharp/server';
import { CompositeDisposable, Subject } from 'rx';
import { ProjectInformationResponse } from '../omnisharp/protocol';

const debounce = require('lodash.debounce');

let defaultSelector: vscode.DocumentSelector = [
    'csharp', // c#-files OR
    { pattern: '**/project.json' }, // project.json-files OR
    { pattern: '**/*.sln' }, // any solution file OR
    { pattern: '**/*.csproj' }, // an csproj file
    { pattern: '**/*.csx' }, // C# script
    { pattern: '**/*.cake' } // Cake script
];

export interface GetActiveTextEditor {
    (): vscode.TextEditor;
}

export interface Match {
    (selector: vscode.DocumentSelector, document: any): number;
}

export class OmnisharpStatusBarObserver {
    private defaultStatus: Status;
    private projectStatus: Status;
    private localDisposables: CompositeDisposable;

    constructor(private getActiveTextEditor: GetActiveTextEditor, private match: Match, private statusBar: vscode.StatusBarItem) {
        this.defaultStatus = new Status(defaultSelector);
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.constructor.name) {
            case ObservableEvent.OmnisharpServerOnServerError.name:
                SetStatus(this.defaultStatus, '$(flame) Error starting OmniSharp', 'o.showOutput', '');
                this.render();
                break;
            case ObservableEvent.OmnisharpOnMultipleLaunchTargets.name:
                SetStatus(this.defaultStatus, '$(flame) Select project', 'o.pickProjectAndStart', 'rgb(90, 218, 90)');
                this.render();
                break;
            case ObservableEvent.OmnisharpOnBeforeServerInstall.name:
                SetStatus(this.defaultStatus, '$(flame) Installing OmniSharp...', 'o.showOutput', '');
                this.render();
                break;
            case ObservableEvent.OmnisharpOnBeforeServerStart.name:
                SetStatus(this.defaultStatus, '$(flame) Starting...', 'o.showOutput', '');
                this.render();
                break;
            case ObservableEvent.ActiveTextEditorChanged.name:
                this.render();
                break;
            case ObservableEvent.OmnisharpServerOnStop.name:
                this.handleOmnisharpServerOnStop();
                break;
            case ObservableEvent.OmnisharpServerOnStart.name:
                this.handleOmnisharpServerOnStart(<ObservableEvent.OmnisharpServerOnStart>event);
                break;
        }
    }

    private updateProjectInfo = (server: OmniSharpServer) => {
        serverUtils.requestWorkspaceInformation(server).then(info => {

            interface Project {
                Path: string;
                SourceFiles: string[];
            }

            let fileNames: vscode.DocumentFilter[] = [];
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
            this.projectStatus = new Status(fileNames);
            SetStatus(this.projectStatus, '$(flame) ' + label, 'o.pickProjectAndStart');
            SetStatus(this.defaultStatus, '$(flame) Switch projects', 'o.pickProjectAndStart');
            this.render();
        });
    }

    private render = () => {
        let activeTextEditor = this.getActiveTextEditor();
        if (!activeTextEditor) {
            this.statusBar.hide();
            return;
        }

        let document = activeTextEditor.document;
        let status: Status;

        if (this.projectStatus && this.match(this.projectStatus.selector, document)) {
            status = this.projectStatus;
        } else if (this.defaultStatus.text && this.match(this.defaultStatus.selector, document)) {
            status = this.defaultStatus;
        }

        if (status) {
            this.statusBar.text = status.text;
            this.statusBar.command = status.command;
            this.statusBar.color = status.color;
            this.statusBar.show();
            return;
        }

        this.statusBar.hide();
    }

    private handleOmnisharpServerOnStop() {
        this.projectStatus = undefined;
        this.defaultStatus.text = undefined;
        let disposables =  this.localDisposables;
        this.localDisposables = undefined;

        if (disposables) {
            disposables.dispose();
        }
    }

    private handleOmnisharpServerOnStart(event: ObservableEvent.OmnisharpServerOnStart) {
        this.localDisposables = new CompositeDisposable();
        SetStatus(this.defaultStatus, '$(flame) Running', 'o.pickProjectAndStart', '');
        this.render();
        let updateProjectInfoFunction = () => this.updateProjectInfo(event.server);
        let debouncedUpdateProjectInfo = debounce(updateProjectInfoFunction, 1500, { leading: true });
        this.localDisposables.add(event.server.onProjectAdded(debouncedUpdateProjectInfo));
        this.localDisposables.add(event.server.onProjectChange(debouncedUpdateProjectInfo));
        this.localDisposables.add(event.server.onProjectRemoved(debouncedUpdateProjectInfo));
    }
}

function SetStatus(status: Status, text: string, command: string, color?: string) {
    status.text = text;
    status.command = command;
    status.color = color;
}