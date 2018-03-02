/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message, MessageType } from "./messageType";

import { Logger } from "../logger";
import { PackageError } from "../packages";

export class csharpLoggerObserver {
    private logger;

    constructor(loggerCreator: () => Logger) {
        this.logger = loggerCreator();
    }

    public onNext(message: Message) {
        switch (message.type) {
            case MessageType.ActivationFailure:
                this.logger.appendLine("[ERROR]: C# Extension failed to get platform information.");
                break;
            case MessageType.PackageInstallation:
                this.logger.append(`Installing ${message.packageInfo}...`);
                this.logger.appendLine();
                break;
            case MessageType.Platform:    
                this.logger.appendLine(`Platform: ${message.info.toString()}`);
                this.logger.appendLine();
                break;
            case MessageType.InstallationFailure:
                this.logger.appendLine(`Failed at stage: ${message.stage}`);
                if (message.error instanceof PackageError) {
                    if (message.error.innerError) {
                        this.logger.appendLine(message.error.innerError.toString());
                    }
                    else {
                        this.logger.appendLine(message.error.message);
                    }
                }
                else {
                    // do not log raw errorMessage in telemetry as it is likely to contain PII.
                    this.logger.appendLine(message.error.toString());
                }
                this.logger.appendLine();
                break;
            case MessageType.InstallationSuccess:
                this.logger.appendLine('Finished');
                this.logger.appendLine();
                break;
            case MessageType.InstallationProgress:
                this.logger.appendLine(message.message);
                this.logger.appendLine();
                break;
            case MessageType.DownloadStart:
            case MessageType.DownloadProgress:    
                this.logger.append(message.message);
                break;
            case MessageType.DownloadEnd:
            case MessageType.DebuggerPreRequisiteFailure:
            case MessageType.DebuggerPreRequisiteWarning:
                this.logger.appendLine(message.message);
                break;
        }
    }
}