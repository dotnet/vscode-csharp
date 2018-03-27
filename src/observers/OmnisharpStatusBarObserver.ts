/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//import * as serverUtils from '../omnisharp/utils';
import { CompositeDisposable, Subject, Scheduler } from 'rx';
import { DocumentFilter, DocumentSelector, StatusBarItem, vscode } from '../vscodeAdapter';
import { OmniSharpServer } from '../omnisharp/server';
import { Status } from './status';
import { basename } from 'path';
import { OmnisharpServerOnServerError, BaseEvent, OmnisharpOnMultipleLaunchTargets, OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, ActiveTextEditorChanged, OmnisharpServerOnStop, OmnisharpServerOnStart, ProjectModified, WorkspaceInformationUpdated } from "../omnisharp/loggingEvents";

let defaultSelector: DocumentSelector = [
    'csharp', // c#-files OR
    { pattern: '**/project.json' }, // project.json-files OR
    { pattern: '**/*.sln' }, // any solution file OR
    { pattern: '**/*.csproj' }, // an csproj file
    { pattern: '**/*.csx' }, // C# script
    { pattern: '**/*.cake' } // Cake script
];

export class OmnisharpStatusBarObserver {
    private defaultStatus: Status;
    private projectStatus: Status;
    private localDisposables: CompositeDisposable;
    private updateProjectDebouncer: Subject<OmniSharpServer>;
    private firstUpdateProject: boolean;

    constructor(private vscode: vscode, private statusBarItem: StatusBarItem, scheduler?: Scheduler) {
        this.defaultStatus = new Status(defaultSelector);
        /*this.updateProjectDebouncer = new Subject<OmniSharpServer>();
        this.updateProjectDebouncer.debounce(1500, scheduler).subscribe((server: OmniSharpServer) => { this.updateProjectInfo(server); });
        this.firstUpdateProject = true;*/
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpServerOnServerError.name:
                SetStatus(this.defaultStatus, '$(flame) Error starting OmniSharp', 'o.showOutput', '');
                this.render();
                break;
            case OmnisharpOnMultipleLaunchTargets.name:
                SetStatus(this.defaultStatus, '$(flame) Select project', 'o.pickProjectAndStart', 'rgb(90, 218, 90)');
                this.render();
                break;
            case OmnisharpOnBeforeServerInstall.name:
                SetStatus(this.defaultStatus, '$(flame) Installing OmniSharp...', 'o.showOutput', '');
                this.render();
                break;
            case OmnisharpOnBeforeServerStart.name:
                SetStatus(this.defaultStatus, '$(flame) Starting...', 'o.showOutput', '');
                this.render();
                break;
            case ActiveTextEditorChanged.name:
                this.render();
                break;
            case OmnisharpServerOnStop.name:
                this.handleOmnisharpServerOnStop();
                break;
            case OmnisharpServerOnStart.name:
                this.handleOmnisharpServerOnStart(<OmnisharpServerOnStart>event);
                break;
            case WorkspaceInformationUpdated.name:
                this.handleWorkspaceInformationUpdated(<WorkspaceInformationUpdated>event);     
        }
    }

    private handleWorkspaceInformationUpdated(event: WorkspaceInformationUpdated) {
        interface Project {
            Path: string;
            SourceFiles: string[];
        }

        let fileNames: DocumentFilter[] = [];
        let label: string;

        function addProjectFileNames(project: Project) {
            fileNames.push({ pattern: project.Path });

            if (project.SourceFiles) {
                for (let sourceFile of project.SourceFiles) {
                    fileNames.push({ pattern: sourceFile });
                }
            }
        }

        let info = event.info;
        // show sln-file if applicable
        if (info.MsBuild && info.MsBuild.SolutionPath) {
            label = basename(info.MsBuild.SolutionPath); //workspace.getRelativePath(info.MsBuild.SolutionPath);
            fileNames.push({ pattern: info.MsBuild.SolutionPath });

            for (let project of info.MsBuild.Projects) {
                addProjectFileNames(project);
            }
        }

        // set project info
        this.projectStatus = new Status(fileNames);
        SetStatus(this.projectStatus, '$(flame) ' + label, 'o.pickProjectAndStart');
        SetStatus(this.defaultStatus, '$(flame) Switch projects', 'o.pickProjectAndStart');
        this.render();
    }

    /*private updateProjectInfo = (server: OmniSharpServer) => {
        this.firstUpdateProject = false;
        serverUtils.requestWorkspaceInformation(server).then(info => {

            
        });
    }*/

    private render = () => {
        let activeTextEditor = this.vscode.window.activeTextEditor;
        if (!activeTextEditor) {
            this.statusBarItem.hide();
            return;
        }

        let document = activeTextEditor.document;
        let status: Status;

        if (this.projectStatus && this.vscode.languages.match(this.projectStatus.selector, document)) {
            status = this.projectStatus;
        } else if (this.defaultStatus.text && this.vscode.languages.match(this.defaultStatus.selector, document)) {
            status = this.defaultStatus;
        }

        if (status) {
            this.statusBarItem.text = status.text;
            this.statusBarItem.command = status.command;
            this.statusBarItem.color = status.color;
            this.statusBarItem.show();
            return;
        }

        this.statusBarItem.hide();
    }

    private handleOmnisharpServerOnStop() {
        this.projectStatus = undefined;
        this.defaultStatus.text = undefined;
        let disposables = this.localDisposables;
        this.localDisposables = undefined;

        if (disposables) {
            disposables.dispose();
        }
    }

    private handleOmnisharpServerOnStart(event: OmnisharpServerOnStart) {
        //this.localDisposables = new CompositeDisposable();
        SetStatus(this.defaultStatus, '$(flame) Running', 'o.pickProjectAndStart', '');
        this.render();
        /*let updateTracker = () => {
            if (this.firstUpdateProject) {
                this.updateProjectInfo(event.server);
            }
            else {
                this.updateProjectDebouncer.onNext(event.server);
            }
        };
        
        this.localDisposables.add(event.server.onProjectAdded(updateTracker));
        this.localDisposables.add(event.server.onProjectChange(updateTracker));
        this.localDisposables.add(event.server.onProjectRemoved(updateTracker));*/
    }
}

function SetStatus(status: Status, text: string, command: string, color?: string) {
    status.text = text;
    status.command = command;
    status.color = color;
}