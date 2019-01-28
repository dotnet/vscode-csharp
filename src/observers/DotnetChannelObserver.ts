/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent, CommandDotNetRestoreStart } from "../omnisharp/loggingEvents";

export class DotNetChannelObserver extends BaseChannelObserver {
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case CommandDotNetRestoreStart.name:
                this.clearChannel();
                this.showChannel(true);
                break;
        }
    }
}