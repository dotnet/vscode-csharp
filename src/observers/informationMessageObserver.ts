/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ObservableEvent from "../omnisharp/loggingEvents";
import { vscode } from '../vscodeAdapter';
import showInformationMessage from "../shared/observers/utils/showInformationMessage";
import { EventType } from "../omnisharp/eventType";
import OptionProvider from "../shared/observers/optionProvider";

export class InformationMessageObserver {
    constructor(private vscode: vscode, private optionProvider: OptionProvider) {
    }

    public post = (event: ObservableEvent.BaseEvent) => {
        switch (event.type) {
            case EventType.OmnisharpServerUnresolvedDependencies:
                this.handleOmnisharpServerUnresolvedDependencies();
                break;
        }
    };

    private async handleOmnisharpServerUnresolvedDependencies() {
        //to do: determine if we need the unresolved dependencies message
        if (!this.optionProvider.GetLatestOptions().omnisharpOptions.suppressDotnetRestoreNotification) {
            const message = `There are unresolved dependencies. Please execute the restore command to continue.`;
            return showInformationMessage(this.vscode, message, { title: "Restore", command: "dotnet.restore.all" });
        }
    }
}
