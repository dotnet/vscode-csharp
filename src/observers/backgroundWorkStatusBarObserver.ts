/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseStatusBarItemObserver } from './baseStatusBarItemObserver';
import { BaseEvent, OmnisharpBackgroundDiagnosticStatus } from '../omnisharp/loggingEvents';
import { EventType } from '../omnisharp/eventType';
import { BackgroundDiagnosticStatus } from '../omnisharp/protocol';

export class BackgroundWorkStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        if (event.type === EventType.BackgroundDiagnosticStatus) {
            const asProjectEvent = <OmnisharpBackgroundDiagnosticStatus>event;

            if (asProjectEvent.message.Status !== BackgroundDiagnosticStatus.Finished) {
                const { NumberFilesRemaining, NumberFilesTotal } = asProjectEvent.message;
                const message = `Analyzing ${NumberFilesTotal} files - Remaining ${NumberFilesRemaining} files`;
                this.SetAndShowStatusBar(`$(sync~spin) ${message}`, 'o.showOutput', undefined, `${message}`);
            } else {
                this.ResetAndHideStatusBar();
            }
        }
    };
}
