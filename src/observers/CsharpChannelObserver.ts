/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseChannelObserver } from "./BaseChannelObserver";
import { BaseEvent, PackageInstallation, InstallationFailure, DebuggerNotInstalledFailure, DebuggerPreRequisiteFailure, ProjectJsonDeprecatedWarning } from "../omnisharp/loggingEvents";

export class CsharpChannelObserver extends BaseChannelObserver {
    public onNext = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case PackageInstallation.name:
            case InstallationFailure.name:
            case DebuggerNotInstalledFailure.name:
            case DebuggerPreRequisiteFailure.name:
            case ProjectJsonDeprecatedWarning.name:
                this.showChannel();
                break;
        }
    }
}