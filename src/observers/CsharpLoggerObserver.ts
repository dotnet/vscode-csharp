/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseLoggerObserver } from "./BaseLoggerObserver";
import * as Event from "../omnisharp/loggingEvents";
import { PackageError } from "../packageManager/PackageError";

export class CsharpLoggerObserver extends BaseLoggerObserver {
    private dots: number;

    public post = (event: Event.BaseEvent) => {
        switch (event.constructor.name) {
            case Event.ActivationFailure.name:
                this.logger.appendLine("[ERROR]: C# Extension failed to get platform information.");
                break;
            case Event.PackageInstallation.name:
                this.handlePackageInstallation(<Event.PackageInstallation>event);
                break;
            case Event.LogPlatformInfo.name:
                this.handlePlatformInfo(<Event.LogPlatformInfo>event);
                break;
            case Event.InstallationFailure.name:
                this.handleInstallationFailure(<Event.InstallationFailure>event);
                break;
            case Event.InstallationSuccess.name:
                this.logger.appendLine('Finished');
                this.logger.appendLine();
                break;
            case Event.InstallationStart.name:
                this.handleInstallationStart(<Event.InstallationStart>event);
                break;
            case Event.DownloadStart.name:
                this.handleDownloadStart(<Event.DownloadStart>event);
                break;
            case Event.DownloadProgress.name:
                this.handleDownloadProgress(<Event.DownloadProgress>event);
                break;
            case Event.DownloadSuccess.name:
            case Event.DownloadFailure.name:
            case Event.DebuggerPrerequisiteFailure.name:
            case Event.DebuggerPrerequisiteWarning.name:
                this.handleEventWithMessage(<Event.EventWithMessage>event);
                break;
            case Event.ProjectJsonDeprecatedWarning.name:
                this.logger.appendLine("Warning: project.json is no longer a supported project format for .NET Core applications. Update to the latest version of .NET Core (https://aka.ms/netcoredownload) and use 'dotnet migrate' to upgrade your project (see https://aka.ms/netcoremigrate for details).");
                break;
            case Event.DownloadFallBack.name:
                this.handleDownloadFallback(<Event.DownloadFallBack>event);
                break;
            case Event.DownloadSizeObtained.name:
                this.handleDownloadSizeObtained(<Event.DownloadSizeObtained>event);
                break;
            case Event.LatestBuildDownloadStart.name:
                this.logger.appendLine("Getting latest OmniSharp version information");
                break;
        }
    }

    private handleDownloadSizeObtained(event: Event.DownloadSizeObtained) {
        this.logger.append(`(${Math.ceil(event.packageSize / 1024)} KB)`);
    }

    private handleDownloadFallback(event: Event.DownloadFallBack) {
        this.logger.append(`\tRetrying from '${event.fallbackUrl}' `);
    }

    private handleEventWithMessage(event: Event.EventWithMessage) {
        this.logger.appendLine(event.message);
    }

    private handlePackageInstallation(event: Event.PackageInstallation) {
        this.logger.append(`Installing ${event.packageInfo}...`);
        this.logger.appendLine();
    }

    private handlePlatformInfo(event: Event.LogPlatformInfo) {
        this.logger.appendLine(`Platform: ${event.info.toString()}`);
        this.logger.appendLine();
    }

    private handleInstallationFailure(event: Event.InstallationFailure) {
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

    private handleDownloadProgress(event: Event.DownloadProgress) {
        let newDots = Math.ceil(event.downloadPercentage / 5);
        this.logger.append('.'.repeat(newDots - this.dots));
        this.dots = newDots;
    }

    private handleDownloadStart(event: Event.DownloadStart) {
        this.logger.append(`Downloading package '${event.packageDescription}' `);
        this.dots = 0;
    }

    private handleInstallationStart(event: Event.InstallationStart) {
        this.logger.appendLine(`Installing package '${event.packageDescription}'`);
        this.logger.appendLine();
    }
}