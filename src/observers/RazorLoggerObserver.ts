/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseLoggerObserver } from "./BaseLoggerObserver";
import { RazorPluginPathSpecified, BaseEvent, RazorPluginPathDoesNotExist, RazorDevModeActive } from "../omnisharp/loggingEvents";

export class RazorLoggerObserver extends BaseLoggerObserver {
    public post = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case RazorPluginPathSpecified.name:
                this.handleRazorPluginPathSpecifiedMessage(<RazorPluginPathSpecified>event);
                break;
            case RazorPluginPathDoesNotExist.name:
                this.handleRazorPluginPathDoesNotExistMessage(<RazorPluginPathDoesNotExist>event);
                break;
            case RazorDevModeActive.name:
                this.handleRazorDevMode();
                break;
        }
    }

    private handleRazorPluginPathSpecifiedMessage(event: RazorPluginPathSpecified) {
        this.logger.appendLine('Razor Plugin Path Specified');
        this.logger.increaseIndent();
        this.logger.appendLine(`Path: ${event.path}`);
        this.logger.decreaseIndent();
        this.logger.appendLine();
    }

    private handleRazorPluginPathDoesNotExistMessage(event: RazorPluginPathSpecified) {
        this.logger.appendLine(`[error]: Razor plugin path was specified as '${event.path}' but does not exist on disk.`);
    }

    private handleRazorDevMode() {
        this.logger.appendLine('Razor dev mode active. Suppressing built-in OmniSharp Razor support.');
        this.logger.appendLine();
    }
}