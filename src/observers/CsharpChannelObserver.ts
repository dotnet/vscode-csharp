/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { EventType } from "../omnisharp/EventType";
import { BaseEvent } from "../omnisharp/loggingEvents";
import { OutputChannel, vscode } from "../vscodeAdapter";

export class CsharpChannelObserver extends BaseChannelObserver {
    constructor(channel: OutputChannel, private vscode: vscode) {
        super(channel);
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.PackageInstallStart:
            case EventType.IntegrityCheckFailure:
            case EventType.InstallationFailure:
            case EventType.DebuggerNotInstalledFailure:
            case EventType.DebuggerPrerequisiteFailure:
            case EventType.ProjectJsonDeprecatedWarning:
                let csharpConfig = this.vscode.workspace.getConfiguration('csharp');
                if (csharpConfig.get<boolean>('showOmnisharpLogOnError')) {
                    this.showChannel(true);
                }
                break;
            case EventType.ShowChannel:
                this.showChannel(false);
                break;
        }
    }
}