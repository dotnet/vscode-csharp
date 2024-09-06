/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
    BaseEvent,
    ZipError,
    DotNetTestRunFailure,
    DotNetTestDebugStartFailure,
    IntegrityCheckFailure,
} from '../loggingEvents';
import { vscode } from '../../vscodeAdapter';
import showErrorMessage from './utils/showErrorMessage';
import { EventType } from '../eventType';
import { l10n } from 'vscode';

export class ErrorMessageObserver {
    constructor(private vscode: vscode) {}

    public post = (event: BaseEvent) => {
        switch (event.type) {
            case EventType.ZipError:
                this.handleZipError(<ZipError>event);
                break;
            case EventType.DotNetTestRunFailure:
                this.handleDotnetTestRunFailure(<DotNetTestRunFailure>event);
                break;
            case EventType.DotNetTestDebugStartFailure:
                this.handleDotNetTestDebugStartFailure(<DotNetTestDebugStartFailure>event);
                break;
            case EventType.IntegrityCheckFailure:
                this.handleIntegrityCheckFailure(<IntegrityCheckFailure>event);
        }
    };

    handleIntegrityCheckFailure(event: IntegrityCheckFailure) {
        if (!event.retry) {
            showErrorMessage(
                this.vscode,
                l10n.t(
                    `Package {0} download from {1} failed integrity check. Some features may not work as expected. Please restart Visual Studio Code to retrigger the download`,
                    event.packageDescription,
                    event.url
                )
            );
        }
    }

    private handleZipError(event: ZipError) {
        showErrorMessage(this.vscode, event.message);
    }

    private handleDotnetTestRunFailure(event: DotNetTestRunFailure) {
        showErrorMessage(this.vscode, l10n.t(`Failed to run test: {0}`, event.message));
    }

    private handleDotNetTestDebugStartFailure(event: DotNetTestDebugStartFailure) {
        showErrorMessage(this.vscode, l10n.t(`Failed to start debugger: {0}`, event.message));
    }
}
