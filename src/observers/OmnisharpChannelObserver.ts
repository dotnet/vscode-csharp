/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { vscode, OutputChannel } from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerOnStdErr } from '../omnisharp/loggingEvents';
import { EventType } from "../omnisharp/EventType";

export class OmnisharpChannelObserver extends BaseChannelObserver {
    constructor(channel: OutputChannel, private vscode: vscode) {
        super(channel);
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ShowOmniSharpChannel:
            case EventType.OmnisharpFailure:
                this.showChannel(true);
                break;
            case EventType.OmnisharpServerOnStdErr:
                this.handleOmnisharpServerOnStdErr(<OmnisharpServerOnStdErr>event);
                break;
            case EventType.OmnisharpRestart:
                this.clearChannel();
                break;
        }
    }

    private async handleOmnisharpServerOnStdErr(event: OmnisharpServerOnStdErr) {
        let csharpConfig = this.vscode.workspace.getConfiguration('csharp');
        if (csharpConfig.get<boolean>('showOmnisharpLogOnError')) {
            this.showChannel(true);
        }
    }
}