/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from 'path';
import { BaseEvent, OmnisharpOnMultipleLaunchTargets, WorkspaceInformationUpdated, OmnisharpServerOnStop } from "../omnisharp/loggingEvents";
import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';

export class ProjectStatusBarObserver extends BaseStatusBarItemObserver {

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpOnMultipleLaunchTargets.name:
                this.SetAndShowStatusBar('$(file-submodule) Select project', 'o.pickProjectAndStart', 'rgb(90, 218, 90)', '');
                break;
            case OmnisharpServerOnStop.name:
                this.ResetAndHideStatusBar();
                break;
            case WorkspaceInformationUpdated.name:
                this.handleWorkspaceInformationUpdated(<WorkspaceInformationUpdated>event);
        }
    }

    private handleWorkspaceInformationUpdated(event: WorkspaceInformationUpdated) {
        let label: string;
        let info = event.info;
        if (info.MsBuild && info.MsBuild.SolutionPath) {
            label = basename(info.MsBuild.SolutionPath); //workspace.getRelativePath(info.MsBuild.SolutionPath);
            this.SetAndShowStatusBar('$(file-directory) ' + label, 'o.pickProjectAndStart', '', '');
        }
        else {
            this.ResetAndHideStatusBar();
        }
    }
}