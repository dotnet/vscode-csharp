/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentFilter } from '../vscodeAdapter';
import { basename } from 'path';
import { BaseEvent, OmnisharpOnMultipleLaunchTargets, ActiveTextEditorChanged, WorkspaceInformationUpdated } from "../omnisharp/loggingEvents";
import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';

export class ProjectStatusBarObserver  extends BaseStatusBarItemObserver{
    /* Notes: Since we have removed the listeners and the disposables from the server start and stop event, 
    we will not show up the status bar item :) 
    */
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpOnMultipleLaunchTargets.name:
                this.SetAndShowStatusBar('Select project', 'o.pickProjectAndStart', 'rgb(90, 218, 90)');
                break;
            case ActiveTextEditorChanged.name:
                //this.render();
                break;
            /*
            cross check what do we need to do on these events. Should we call the hide when the stop event is there
            case OmnisharpServerOnStop.name:
                this.projectStatus = undefined;
                this.defaultStatus.text = undefined;
                break;
            case OmnisharpServerOnStart.name:
                SetStatus(this.defaultStatus, '$(flame) Running', 'o.pickProjectAndStart', '');
                this.render();
                break;*/
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

        // if we remove the matching then this whole concept of making the filenames array doesnot make any sense\
        // What to do ?????
        // And is it possible that we have the inof but no msbuild so that label is undefined
        // should we include the set thing inside the if ????
        if (info.MsBuild && info.MsBuild.SolutionPath) {
            label = basename(info.MsBuild.SolutionPath); //workspace.getRelativePath(info.MsBuild.SolutionPath);
            fileNames.push({ pattern: info.MsBuild.SolutionPath });

            for (let project of info.MsBuild.Projects) {
                addProjectFileNames(project);
            }
        }

        this.SetAndShowStatusBar(label, 'o.pickProjectAndStart');
    }
}