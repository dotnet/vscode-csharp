/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { BaseLoggerObserver } from '../../shared/observers/baseLoggerObserver.ts';
import { BaseEvent } from '../../shared/loggingEvents.ts';
import {
    CommandDotNetRestoreProgress,
    CommandDotNetRestoreSucceeded,
    CommandDotNetRestoreFailed,
} from '../omnisharpLoggingEvents.ts';
import { EventType } from '../../shared/eventType.ts';

export class DotnetLoggerObserver extends BaseLoggerObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.CommandDotNetRestoreProgress:
                this.logger.append((<CommandDotNetRestoreProgress>event).message);
                break;
            case EventType.CommandDotNetRestoreSucceeded:
                this.logger.appendLine((<CommandDotNetRestoreSucceeded>event).message);
                break;
            case EventType.CommandDotNetRestoreFailed:
                this.logger.appendLine((<CommandDotNetRestoreFailed>event).message);
                break;
        }
    };
}
