/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Options } from "../omnisharp/options";
import { BaseEvent, WorkspaceConfigurationChanged } from "../omnisharp/loggingEvents";
import { vscode } from "../vscodeAdapter";
import { MessageItemWithCommand } from "./WarningMessageObserver";

export default class OmniSharpConfigChangeObserver {
    private options: Options;

    constructor(private vscode: vscode) {
        this.options = this.readOmniSharpOptions();
    }

    private readOmniSharpOptions() {
        return Options.Read(this.vscode);
    }

    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case WorkspaceConfigurationChanged.name:
                this.handleWorkspaceConfigurationChanged();
                break;
        }
    }

    private async handleWorkspaceConfigurationChanged() {
        let newOptions = this.readOmniSharpOptions();
        if (JSON.stringify(newOptions) != JSON.stringify(this.options)) {
            let message = "OmniSharp configuration has changed, please restart OmniSharp.";
            let value = await this.vscode.window.showWarningMessage<MessageItemWithCommand>(message, { title: "Restart Now", command: 'o.restart' });
            if (value) {
                await this.vscode.commands.executeCommand<string>(value.command);
            }

            this.options = newOptions;
        }
    }
}