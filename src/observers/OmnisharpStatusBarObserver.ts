/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentFilter, DocumentSelector, StatusBarItem, vscode } from '../vscodeAdapter';
import { basename } from 'path';
import { OmnisharpServerOnServerError, BaseEvent, OmnisharpOnMultipleLaunchTargets, OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, ActiveTextEditorChanged, OmnisharpServerOnStop, OmnisharpServerOnStart, WorkspaceInformationUpdated } from "../omnisharp/loggingEvents";

export class OmnisharpStatusBarObserver {

    constructor(private vscode: vscode, private statusBarItem: StatusBarItem) {
    }
    //This should not care about the 
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case OmnisharpServerOnServerError.name:
                this.SetAndRenderStatusBar('$(flame) Error starting OmniSharp', 'o.showOutput', '');
                break;
            case OmnisharpOnMultipleLaunchTargets.name:
                this.SetAndRenderStatusBar('$(flame) Select project', 'o.showOutput', 'rgb(90, 218, 90)');
                break;
            case OmnisharpOnBeforeServerInstall.name:
                this.SetAndRenderStatusBar('$(flame) Installing OmniSharp...', 'o.showOutput', '');
                break;
            case OmnisharpOnBeforeServerStart.name:
                this.SetAndRenderStatusBar('$(flame) Starting...', 'o.showOutput', '');
                break;
            case ActiveTextEditorChanged.name:
                break;
            case OmnisharpServerOnStop.name:
                this.statusBarItem.text = undefined;
                this.statusBarItem.command = undefined;
                this.statusBarItem.color = undefined;
                this.statusBarItem.hide();
                break;
            case OmnisharpServerOnStart.name:
                this.SetAndRenderStatusBar('$(flame) Running', 'o.showOutput', '');
                break;
        }
    }

    private SetAndRenderStatusBar(text: string, command: string, color?: string) {
        this.statusBarItem.text = text;
        this.statusBarItem.command = command;
        this.statusBarItem.color = color;
        this.statusBarItem.show();
    }
}

