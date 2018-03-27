/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ObservableEvent from "../omnisharp/loggingEvents";
import { vscode } from '../vscodeAdapter';

export class InformationMessageObserver {
    constructor(private vscode: vscode) {
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.constructor.name) {
            case ObservableEvent.OmnisharpServerUnresolvedDependencies.name:
            this.handleOmnisharpServerUnresolvedDependencies(<ObservableEvent.OmnisharpServerUnresolvedDependencies>event);
            break;
        }
    }

    private handleOmnisharpServerUnresolvedDependencies(event: ObservableEvent.OmnisharpServerUnresolvedDependencies) {
        let csharpConfig = this.vscode.workspace.getConfiguration('csharp');
        if (!csharpConfig.get<boolean>('suppressDotnetRestoreNotification')) {
            let info = `There are unresolved dependencies from '${this.vscode.workspace.asRelativePath(event.unresolvedDependencies.FileName)}'. Please execute the restore command to continue.`;
            return this.vscode.window.showInformationMessage(info, 'Restore').then(value => {
                if (value) {
                    this.vscode.commands.executeCommand('dotnet.restore', event.unresolvedDependencies.FileName);
                }
            });
        }
    }
}
