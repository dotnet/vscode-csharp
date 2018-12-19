/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent, InstallationFailure, DebuggerNotInstalledFailure, DebuggerPrerequisiteFailure, ProjectJsonDeprecatedWarning, PackageInstallStart, IntegrityCheckFailure } from "../omnisharp/loggingEvents";

export class CsharpChannelObserver extends BaseChannelObserver {
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case PackageInstallStart.name:
            case IntegrityCheckFailure.name:
                this.showChannel(true);
                break;
            case InstallationFailure.name:
            case DebuggerNotInstalledFailure.name:
            case DebuggerPrerequisiteFailure.name:
            case ProjectJsonDeprecatedWarning.name:
                this.showChannel();
                break;
        }
    }
}