/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent } from "../omnisharp/loggingEvents";

export default class DotnetTestLogChannelObserver extends BaseChannelObserver {
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            
        }
    }
}