/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PackageError } from "../packages";
import { BaseLoggerObserver } from "./BaseLoggerObserver";
import { BaseEvent, ActivationFailure, PackageInstallation, PlatformInfoEvent, InstallationFailure, InstallationSuccess, InstallationProgress, DownloadStart, DownloadProgress, DownloadSuccess, DownloadFailure, DebuggerPreRequisiteFailure, DebuggerPreRequisiteWarning, ProjectJsonDeprecatedWarning, EventWithMessage } from "../omnisharp/loggingEvents";

export class CsharpLoggerObserver extends BaseLoggerObserver {
    private dots: number;

    public onNext = (event: BaseEvent) => {
        switch (event.constructor.name) {
            case ActivationFailure.name:
                this.logger.appendLine("[ERROR]: C# Extension failed to get platform information.");
                break;
            case PackageInstallation.name:
                this.handlePackageInstallation(<PackageInstallation>event);
                break;
            case PlatformInfoEvent.name:
                this.handlePlatformInfo(<PlatformInfoEvent>event);
                break;
            case InstallationFailure.name:
                this.handleInstallationFailure(<InstallationFailure>event);
                break;
            case InstallationSuccess.name:
                this.logger.appendLine('Finished');
                this.logger.appendLine();
                break;
            case InstallationProgress.name:
                this.handleInstallationProgress(<InstallationProgress>event);
                break;
            case DownloadStart.name:
                this.handleDownloadStart(<DownloadStart>event);
                break;
            case DownloadProgress.name:
                this.handleDownloadProgress(<DownloadProgress>event);
                break;
            case DownloadSuccess.name:
            case DownloadFailure.name:
            case DebuggerPreRequisiteFailure.name:
            case DebuggerPreRequisiteWarning.name:
                this.handleEventWithMessage(<EventWithMessage>event);
                break;
            case ProjectJsonDeprecatedWarning.name:
                this.logger.appendLine("Warning: project.json is no longer a supported project format for .NET Core applications. Update to the latest version of .NET Core (https://aka.ms/netcoredownload) and use 'dotnet migrate' to upgrade your project (see https://aka.ms/netcoremigrate for details).");
                break;
        }
    }

    private handleEventWithMessage(event: EventWithMessage) {
        this.logger.appendLine(event.message);
    }

    private handlePackageInstallation(event: PackageInstallation) {
        this.logger.append(`Installing ${event.packageInfo}...`);
        this.logger.appendLine();
    }

    private handlePlatformInfo(event: PlatformInfoEvent) {
        this.logger.appendLine(`Platform: ${event.info.toString()}`);
        this.logger.appendLine();
    }

    private handleInstallationFailure(event: InstallationFailure) {
        this.logger.appendLine(`Failed at stage: ${event.stage}`);
        if (event.error instanceof PackageError) {
            if (event.error.innerError) {
                this.logger.appendLine(event.error.innerError.toString());
            }
            else {
                this.logger.appendLine(event.error.message);
            }
        }
        else {
            // do not log raw errorMessage in telemetry as it is likely to contain PII.
            this.logger.appendLine(event.error.toString());
        }
        this.logger.appendLine();
    }

    private handleDownloadProgress(event: DownloadProgress) {
        let newDots = Math.ceil(event.downloadPercentage / 5);
        if (newDots > this.dots) {
            this.logger.append('.'.repeat(newDots - this.dots));
            this.dots = newDots;
        }
    }

    private handleDownloadStart(event: DownloadStart) {
        this.logger.append(event.message);
        this.dots = 0;
    }

    private handleInstallationProgress(event: InstallationProgress) {
        this.logger.appendLine(event.message);
        this.logger.appendLine();
    }
}