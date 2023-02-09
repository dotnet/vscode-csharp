/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { OutputChannel } from '../vscodeAdapter';
import { BaseEvent, OmnisharpServerOnStdErr } from '../omnisharp/loggingEvents';
import { EventType } from "../omnisharp/EventType";
import OptionProvider from "../shared/observers/OptionProvider";

export class OmnisharpChannelObserver extends BaseChannelObserver {
    constructor(channel: OutputChannel, private optionProvider: OptionProvider) {
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
        if (this.optionProvider.GetLatestOptions().omnisharpOptions.showOmnisharpLogOnError) {
            this.showChannel(true);
        }
    }
}