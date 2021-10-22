/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename, join } from 'path';
import { BaseEvent, WorkspaceInformationUpdated } from "../omnisharp/loggingEvents";
import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';
import { EventType } from '../omnisharp/EventType';

export class ProjectStatusBarObserver extends BaseStatusBarItemObserver {

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpOnMultipleLaunchTargets:
                this.SetAndShowStatusBar('$(file-submodule) Select project', 'o.pickProjectAndStart', 'rgb(90, 218, 90)');
                break;
            case EventType.OmnisharpServerOnStop:
                this.ResetAndHideStatusBar();
                break;
            case EventType.WorkspaceInformationUpdated:
                this.handleWorkspaceInformationUpdated(<WorkspaceInformationUpdated>event);
        }
    }

    private handleWorkspaceInformationUpdated(event: WorkspaceInformationUpdated) {
        let label: string;
        let msbuild = event.info.MsBuild;
        if (msbuild && msbuild.SolutionPath) {
            if (msbuild.SolutionPath.endsWith(".sln")) {
                label = basename(msbuild.SolutionPath);
            }
            else {
                // a project file was open, determine which project
                for (const project of msbuild.Projects) {
                    // Get the project name.
                    label = basename(project.Path);

                    // The solution path is the folder containing the open project. Combine it with the
                    // project name and see if it matches the project's path.
                    if (join(msbuild.SolutionPath, label) === project.Path) {
                        break;
                    }
                }
            }
            this.SetAndShowStatusBar('$(file-directory) ' + label, 'o.pickProjectAndStart');
        }
        else {
            this.ResetAndHideStatusBar();
        }
    }
}