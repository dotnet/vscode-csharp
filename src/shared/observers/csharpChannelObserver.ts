/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from './baseChannelObserver';
import { EventType } from '../eventType';
import { BaseEvent } from '../../shared/loggingEvents';

export class CsharpChannelObserver extends BaseChannelObserver {
    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.PackageInstallStart:
            case EventType.IntegrityCheckFailure:
            case EventType.InstallationFailure:
            case EventType.DebuggerNotInstalledFailure:
            case EventType.DebuggerPrerequisiteFailure:
            case EventType.ProjectJsonDeprecatedWarning:
                this.showChannel(true);
                break;
            case EventType.ShowChannel:
                this.showChannel(false);
                break;
        }
    };
}
