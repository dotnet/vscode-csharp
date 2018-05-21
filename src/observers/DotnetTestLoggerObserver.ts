/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseEvent, DotnetTestRunStart, DotnetTestRunMessage } from "../omnisharp/loggingEvents";
import { BaseLoggerObserver } from "./BaseLoggerObserver";

export default class DotnetTestLoggerObserver extends BaseLoggerObserver {
    
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case DotnetTestRunStart.name:
                this.handleDotnetTestRunStart(<DotnetTestRunStart>event);
                break;
            case DotnetTestRunMessage.name:
                this.logger.appendLine((<DotnetTestRunMessage>event).message);
                break;
        }
    }

    handleDotnetTestRunStart(event: DotnetTestRunStart): any {
        this.logger.appendLine(`Running test ${event.testMethod}...`);
        this.logger.appendLine('');
    }
}