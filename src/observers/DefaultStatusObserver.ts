/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import * as ObservableEvent from "../omnisharp/loggingEvents";
import { Status } from './status';

let defaultSelector: vscode.DocumentSelector = [
    'csharp', // c#-files OR
    { pattern: '**/project.json' }, // project.json-files OR
    { pattern: '**/*.sln' }, // any solution file OR
    { pattern: '**/*.csproj' }, // an csproj file
    { pattern: '**/*.csx' }, // C# script
    { pattern: '**/*.cake' } // Cake script
];


export class DefaultStatusObserver {
    private status: Status;

    constructor(private statusBarItem: vscode.StatusBarItem) {
        this.status = new Status(defaultSelector);
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.constructor.name) {
            case ObservableEvent.OmnisharpServerOnServerError.name:
                this.SetStatus('$(flame) Error starting OmniSharp', 'o.showOutput', '');
                render();
                break;
            case ObservableEvent.OmnisharpOnMultipleLaunchTargets.name:
                this.SetStatus('$(flame) Select project', 'o.pickProjectAndStart', 'rgb(90, 218, 90)');
                render();
                break;
            case ObservableEvent.OmnisharpOnBeforeServerInstall.name:
                this.SetStatus('$(flame) Installing OmniSharp...', 'o.showOutput', '');
                render();
                break;
            case ObservableEvent.OmnisharpOnBeforeServerStart.name:
                this.SetStatus('$(flame) Starting...', 'o.showOutput', '');
                render();
                break;
        }
    }

    private SetStatus(text: string, command: string, color: string) {
        this.status.text = text;
        this.status.command = command;
        this.status.color = color;
    }
}