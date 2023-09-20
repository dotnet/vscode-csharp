/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from './baseChannelObserver';
import { OutputChannel } from '../vscodeAdapter';
import { BaseEvent } from '../omnisharp/loggingEvents';
import { EventType } from '../omnisharp/eventType';
import { omnisharpOptions } from '../shared/options';

export class OmnisharpChannelObserver extends BaseChannelObserver {
    constructor(channel: OutputChannel) {
        super(channel);
    }

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ShowOmniSharpChannel:
            case EventType.OmnisharpFailure:
                this.showChannel(true);
                break;
            case EventType.OmnisharpServerOnStdErr:
                this.handleOmnisharpServerOnStdErr();
                break;
            case EventType.OmnisharpRestart:
                this.clearChannel();
                break;
        }
    };

    private async handleOmnisharpServerOnStdErr() {
        if (omnisharpOptions.showOmnisharpLogOnError) {
            this.showChannel(true);
        }
    }
}
