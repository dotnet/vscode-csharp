/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent } from "../omnisharp/loggingEvents";
import { EventType } from "../omnisharp/EventType";
import { OutputChannel , vscode } from "../vscodeAdapter";

export default class DotnetTestChannelObserver extends BaseChannelObserver {
    constructor(channel: OutputChannel, private vscode: vscode) {
        super(channel);
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.DotNetTestRunStart:
            case EventType.DotNetTestRunFailure:
            case EventType.DotNetTestsInClassRunStart:
            case EventType.DotNetTestDebugStart:
            case EventType.DotNetTestsInClassDebugStart:
            case EventType.DotNetTestRunInContextStart:
            case EventType.DotNetTestDebugInContextStart:
                let csharpConfig = this.vscode.workspace.getConfiguration('csharp');
                if (csharpConfig.get<boolean>('showOmnisharpLogOnError')) {
                    this.showChannel(true);
                }
                break;
        }
    }
}
