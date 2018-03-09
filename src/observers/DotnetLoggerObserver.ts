/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BaseLoggerObserver } from "./BaseLoggerObserver";
import { BaseEvent, CommandDotNetRestoreProgress, CommandDotNetRestoreSucceeded, CommandDotNetRestoreFailed } from "../omnisharp/loggingEvents";

export class DotnetLoggerObserver extends BaseLoggerObserver {
    public onNext = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case CommandDotNetRestoreProgress.name:
                this.logger.append((<CommandDotNetRestoreProgress>event).message);
                break;
            case CommandDotNetRestoreSucceeded.name:
            this.logger.appendLine((<CommandDotNetRestoreSucceeded>event).message);    
            case CommandDotNetRestoreFailed.name:
                this.logger.appendLine((<CommandDotNetRestoreFailed>event).message);
                break;
        }
    }
}