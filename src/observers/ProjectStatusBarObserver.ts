/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from 'path';
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
        let info = event.info;
        if (info.MsBuild && info.MsBuild.SolutionPath) {
            label = basename(info.MsBuild.SolutionPath); //workspace.getRelativePath(info.MsBuild.SolutionPath);
            this.SetAndShowStatusBar('$(file-directory) ' + label, 'o.pickProjectAndStart');
        }
        else {
            this.ResetAndHideStatusBar();
        }
    }
}