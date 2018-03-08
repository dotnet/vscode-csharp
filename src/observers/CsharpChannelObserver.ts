/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Message, MessageType } from "../omnisharp/messageType";
import { BaseChannelObserver } from "./BaseChannelObserver";

export class CsharpChannelObserver extends BaseChannelObserver {
    public onNext = (message: Message) => {
        switch (message.type) {
            case MessageType.PackageInstallation:
            case MessageType.InstallationFailure:
            case MessageType.DebuggerNotInstalledFailure:
            case MessageType.DebuggerPreRequisiteFailure:
            case MessageType.ProjectJsonDeprecatedWarning:
                this.showChannel();
                break;
        }
    }
}