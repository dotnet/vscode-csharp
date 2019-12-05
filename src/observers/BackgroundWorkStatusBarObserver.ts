/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseStatusBarItemObserver } from './BaseStatusBarItemObserver';
import { BaseEvent, OmnisharpProjectDiagnosticStatus } from '../omnisharp/loggingEvents';
import { EventType } from '../omnisharp/EventType';
import { DiagnosticStatus } from '../omnisharp/protocol';

export class BackgroundWorkStatusBarObserver extends BaseStatusBarItemObserver {
    public post = (event: BaseEvent) => {
        if(event.type === EventType.ProjectDiagnosticStatus)
        {
            let asProjectEvent = <OmnisharpProjectDiagnosticStatus>event;

            if(asProjectEvent.message.Status === DiagnosticStatus.Processing)
            {
                let projectFile = asProjectEvent.message.ProjectFilePath.replace(/^.*[\\\/]/, '');
                this.SetAndShowStatusBar(`$(sync~spin) Analyzing ${projectFile}`, 'o.showOutput', null, `Analyzing ${projectFile}`);
            }
            else
            {
                this.ResetAndHideStatusBar();
            }
        }
    }
}

