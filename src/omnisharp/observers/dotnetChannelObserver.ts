/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from '../../shared/observers/baseChannelObserver';
import { EventType } from '../../shared/eventType';
import { BaseEvent } from '../../shared/loggingEvents';

export class DotNetChannelObserver extends BaseChannelObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.CommandDotNetRestoreStart:
                this.clearChannel();
                this.showChannel(true);
                break;
        }
    };
}
