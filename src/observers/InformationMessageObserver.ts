/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from '../vscodeAdapter';
import * as ObservableEvent from "../omnisharp/loggingEvents";
import { dotnetRestoreForProject } from '../features/commands';

export interface GetConfiguration {
    (value: string): vscode.WorkspaceConfiguration;
}

export type ShowInformationMessage =
    ((message: string, ...items: string[]) => Thenable<string | undefined>) |
    ((message: string, options: vscode.MessageOptions, ...items: string[]) => Thenable<string | undefined>) |
    (<T extends vscode.MessageItem>(message: string, ...items: T[]) => Thenable<T | undefined>) |
    (<T extends vscode.MessageItem>(message: string, options: vscode.MessageOptions, ...items: T[]) => Thenable<T | undefined>);

export interface WorkspaceAsRelativePath{
    (pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string;
}

export class InformationMessageObserver {
    constructor(private getConfiguration: GetConfiguration, private showInformationMessage: ShowInformationMessage, private worksapaceAsRelativePath : WorkspaceAsRelativePath) {
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.constructor.name) {
            case ObservableEvent.OmnisharpServerUnresolvedDependencies.name:
            this.handleOmnisharpServerUnresolvedDependencies(<ObservableEvent.OmnisharpServerUnresolvedDependencies>event);
            break;
        }
    }

    private handleOmnisharpServerUnresolvedDependencies(event: ObservableEvent.OmnisharpServerUnresolvedDependencies) {
        let csharpConfig = this.getConfiguration('csharp');
        if (!csharpConfig.get<boolean>('suppressDotnetRestoreNotification')) {
            let info = `There are unresolved dependencies from '${this.worksapaceAsRelativePath(event.unresolvedDependencies.FileName)}'. Please execute the restore command to continue.`;

            return this.showInformationMessage(info, 'Restore').then(value => {
                if (value) {
                    dotnetRestoreForProject(event.server, event.unresolvedDependencies.FileName, event.eventStream);
                }
            });
        }
    }
}
