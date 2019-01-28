/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent, DotNetTestRunStart, DotNetTestRunFailure, DotNetTestsInClassRunStart, DotNetTestDebugStart, DotNetTestsInClassDebugStart } from "../omnisharp/loggingEvents";

export default class DotnetTestChannelObserver extends BaseChannelObserver {
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case DotNetTestRunStart.name:
            case DotNetTestRunFailure.name:   
            case DotNetTestsInClassRunStart.name: 
            case DotNetTestDebugStart.name:    
            case DotNetTestsInClassDebugStart.name:    
                this.showChannel(true);
                break;
        }
    }
}