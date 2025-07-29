/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { basename } from 'path';
import { BaseEvent } from '../../shared/loggingEvents';
import { WorkspaceInformationUpdated } from '../omnisharpLoggingEvents';
import { BaseStatusBarItemObserver } from './baseStatusBarItemObserver';
import { EventType } from '../../shared/eventType';

export class ProjectStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpOnMultipleLaunchTargets:
                this.SetAndShowStatusBar(
                    '$(file-submodule) ' + vscode.l10n.t('Select project'),
                    'o.pickProjectAndStart',
                    'rgb(90, 218, 90)'
                );
                break;
            case EventType.OmnisharpServerOnStop:
                this.ResetAndHideStatusBar();
                break;
            case EventType.WorkspaceInformationUpdated:
                this.handleWorkspaceInformationUpdated(<WorkspaceInformationUpdated>event);
        }
    };

    private handleWorkspaceInformationUpdated(event: WorkspaceInformationUpdated) {
        let label: string;
        const msbuild = event.info.MsBuild;
        if (msbuild && msbuild.SolutionPath) {
            label = basename(msbuild.SolutionPath);
            this.SetAndShowStatusBar('$(file-directory) ' + label, 'o.pickProjectAndStart');
        } else {
            this.ResetAndHideStatusBar();
        }
    }
}
