/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';
import { BaseEvent, OmnisharpBackgroundDiagnosticStatus } from '../omnisharp/loggingEvents';
import { EventType } from '../omnisharp/EventType';
import { BackgroundDiagnosticStatus } from '../omnisharp/protocol';

export class BackgroundWorkStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        if (event.type === EventType.BackgroundDiagnosticStatus) {
            let asProjectEvent = <OmnisharpBackgroundDiagnosticStatus>event;

            if (asProjectEvent.message.Status !== BackgroundDiagnosticStatus.Finished) {
                let {NumberFilesRemaining, NumberFilesTotal} = asProjectEvent.message;
                let message = `Analyzing ${NumberFilesTotal} files - Remaining ${NumberFilesRemaining} files`;
                this.SetAndShowStatusBar(`$(sync~spin) ${message}`, 'o.showOutput', null, `${message}`);
            }
            else {
                this.ResetAndHideStatusBar();
            }
        }
    }
}
