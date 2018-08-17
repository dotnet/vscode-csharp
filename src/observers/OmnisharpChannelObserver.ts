/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent, ShowOmniSharpChannel, OmnisharpFailure, OmnisharpRestart, OmnisharpServerOnStdErr } from '../omnisharp/loggingEvents';

export class OmnisharpChannelObserver extends BaseChannelObserver {

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case ShowOmniSharpChannel.name:
            case OmnisharpFailure.name:
            case OmnisharpServerOnStdErr.name:
                this.showChannel();
                break;
            case OmnisharpRestart.name:
                this.clearChannel();
                break;
        }
    }
}