/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseLoggerObserver } from './baseLoggerObserver';
import * as Event from '../../shared/loggingEvents';
import { PackageError } from '../../packageManager/packageError';
import { EventType } from '../eventType';

export class CsharpLoggerObserver extends BaseLoggerObserver {
    private dots = 0;

    public post = (event: Event.BaseEvent) => {
        switch (event.type) {
            case EventType.ActivationFailure:
                this.logger.appendLine('[ERROR]: C# Extension failed to get platform information.');
                break;
            case EventType.PackageInstallation:
                this.handlePackageInstallation(<Event.PackageInstallation>event);
                break;
            case EventType.LogPlatformInfo:
                this.handlePlatformInfo(<Event.LogPlatformInfo>event);
                break;
            case EventType.InstallationFailure:
                this.handleInstallationFailure(<Event.InstallationFailure>event);
                break;
            case EventType.InstallationSuccess:
                this.logger.appendLine('Finished');
                this.logger.appendLine();
                break;
            case EventType.InstallationStart:
                this.handleInstallationStart(<Event.InstallationStart>event);
                break;
            case EventType.DownloadStart:
                this.handleDownloadStart(<Event.DownloadStart>event);
                break;
            case EventType.DownloadProgress:
                this.handleDownloadProgress(<Event.DownloadProgress>event);
                break;
            case EventType.DownloadSuccess:
            case EventType.DownloadFailure:
            case EventType.DebuggerPrerequisiteFailure:
            case EventType.DebuggerPrerequisiteWarning:
                this.handleEventWithMessage(<Event.EventWithMessage>event);
                break;
            case EventType.DownloadFallBack:
                this.handleDownloadFallback(<Event.DownloadFallBack>event);
                break;
            case EventType.DownloadSizeObtained:
                this.handleDownloadSizeObtained(<Event.DownloadSizeObtained>event);
                break;
            case EventType.IntegrityCheckFailure:
                this.handleIntegrityCheckFailure(<Event.IntegrityCheckFailure>event);
                break;
            case EventType.DownloadValidation:
                this.handleDownloadValidation();
                break;
            case EventType.IntegrityCheckSuccess:
                this.handleIntegrityCheckSuccess();
                break;
        }
    };

    private handleDownloadValidation() {
        this.logger.appendLine('Validating download...');
    }

    private handleIntegrityCheckSuccess() {
        this.logger.appendLine('Integrity Check succeeded.');
    }

    private handleIntegrityCheckFailure(event: Event.IntegrityCheckFailure) {
        if (event.retry) {
            this.logger.appendLine(`Package ${event.packageDescription} failed integrity check. Retrying..`);
        } else {
            this.logger.appendLine(
                `Package ${event.packageDescription} download from ${event.url} failed integrity check. Some features may not work as expected. Please restart Visual Studio Code to retrigger the download.`
            );
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
            } else {
                this.logger.appendLine(event.error.message);
            }
        } else {
            // do not log raw errorMessage in telemetry as it is likely to contain PII.
            this.logger.appendLine(event.error.toString());
        }
        this.logger.appendLine();
    }

    private handleDownloadProgress(event: Event.DownloadProgress) {
        const newDots = Math.ceil(event.downloadPercentage / 5);
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
