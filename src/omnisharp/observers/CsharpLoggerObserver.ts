/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Message, MessageType } from "./../messageType";
import { Logger } from "../../logger";
import { PackageError } from "../../packages";

export class CsharpLoggerObserver {


    private logger;
    private dots: number;

    constructor(loggerCreator: () => {
        appendLine: (message?: string) => void;
        append: (message?: string) => void;
    }) {
        this.logger = loggerCreator();
    }

    public onNext = (message: Message) => {
        switch (message.type) {
            case MessageType.ActivationFailure:
                this.logger.appendLine("[ERROR]: C# Extension failed to get platform information.");
                break;
            case MessageType.PackageInstallation:
                this.logger.append(`Installing ${message.packageInfo}...`);
                this.logger.appendLine();
                break;
            case MessageType.PlatformInfo:
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
                this.logger.append(message.message);
                this.dots = 0;
                break;
            case MessageType.DownloadProgress:
                let newDots = Math.ceil(message.downloadPercentage / 5);
                if (newDots > this.dots) {
                    this.logger.append('.'.repeat(newDots - this.dots));
                    this.dots = newDots;
                }
                break;
            case MessageType.DownloadSuccess:
            case MessageType.DownloadFailure:
            case MessageType.DebuggerPreRequisiteFailure:
            case MessageType.DebuggerPreRequisiteWarning:
                this.logger.appendLine(message.message);
                break;
            case MessageType.ProjectJsonDeprecatedWarning:
                this.logger.appendLine("Warning: project.json is no longer a supported project format for .NET Core applications. Update to the latest version of .NET Core (https://aka.ms/netcoredownload) and use 'dotnet migrate' to upgrade your project (see https://aka.ms/netcoremigrate for details).");
                break;
        }
    }
}