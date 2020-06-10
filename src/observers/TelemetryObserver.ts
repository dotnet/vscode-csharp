/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';
import { PlatformInformation } from "../platform";
import { BaseEvent, InstallationFailure, TestExecutionCountReport, TelemetryEventWithMeasures, TelemetryEvent, ProjectConfiguration, TelemetryErrorEvent, OmnisharpInitialisation } from "../omnisharp/loggingEvents";
import { PackageError } from "../packageManager/PackageError";
import { EventType } from "../omnisharp/EventType";
import { getDotnetInfo, DotnetInfo } from "../utils/getDotnetInfo";

export interface ITelemetryReporter {
    sendTelemetryEvent(eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }): void;
    sendTelemetryErrorEvent(eventName: string, properties?: { [key: string]: string; }, measures?: { [key: string]: number; }, errorProps?: string[]): void;
}

export class TelemetryObserver {
    private reporter: ITelemetryReporter;
    private platformInfo: PlatformInformation;
    private solutionId: string;
    private dotnetInfo: DotnetInfo;

    constructor(platformInfo: PlatformInformation, reporterCreator: () => ITelemetryReporter) {
        this.platformInfo = platformInfo;
        this.reporter = reporterCreator();
    }

    public post = (event: BaseEvent) => {
        let telemetryProps = this.getTelemetryProps();
        switch (event.type) {
            case EventType.OmnisharpInitialisation:
                this.handleOmnisharpInitialisation(<OmnisharpInitialisation>event);
                break;
            case EventType.PackageInstallation:
                this.reporter.sendTelemetryEvent("AcquisitionStart");
                break;
            case EventType.InstallationFailure:
                this.handleInstallationFailure(<InstallationFailure>event, telemetryProps);
                break;
            case EventType.InstallationSuccess:
                this.handleInstallationSuccess(telemetryProps);
                break;
            case EventType.OmnisharpDelayTrackerEventMeasures:
            case EventType.OmnisharpStart:
                this.handleTelemetryEventMeasures(<TelemetryEventWithMeasures>event);
                break;
            case EventType.TestExecutionCountReport:
                this.handleTestExecutionCountReport(<TestExecutionCountReport>event);
                break;
            case EventType.TelemetryEvent:
                let telemetryEvent = <TelemetryEvent>event;
                this.reporter.sendTelemetryEvent(telemetryEvent.eventName, telemetryEvent.properties, telemetryEvent.measures);
                break;
            case EventType.TelemetryErrorEvent:
                let telemetryErrorEvent = <TelemetryErrorEvent>event;
                this.reporter.sendTelemetryErrorEvent(telemetryErrorEvent.eventName, telemetryErrorEvent.properties, telemetryErrorEvent.measures, telemetryErrorEvent.errorProps);
                break;
            case EventType.ProjectConfigurationReceived:
                this.handleProjectConfigurationReceived(<ProjectConfiguration>event, telemetryProps);
                break;
        }
    }

    private handleTelemetryEventMeasures(event: TelemetryEventWithMeasures) {
        this.reporter.sendTelemetryEvent(event.eventName, null, event.measures);
    }

    private async handleOmnisharpInitialisation(event: OmnisharpInitialisation) {
        this.dotnetInfo = await getDotnetInfo();
        this.solutionId = this.createSolutionId(event.solutionPath);
    }

    private handleInstallationSuccess(telemetryProps: { [key: string]: string; }) {
        telemetryProps['installStage'] = 'completeSuccess';
        this.reporter.sendTelemetryEvent('AcquisitionSucceeded', telemetryProps);
    }

    private handleInstallationFailure(event: InstallationFailure, telemetryProps: { [key: string]: string; }) {
        telemetryProps['installStage'] = event.stage;
        if (event.error instanceof PackageError) {
            // we can log the message in a PackageError to telemetry as we do not put PII in PackageError messages
            telemetryProps['error.message'] = event.error.message;

            if (event.error.pkg) {
                telemetryProps['error.packageUrl'] = event.error.pkg.url;
            }
        }

        this.reporter.sendTelemetryEvent('AcquisitionFailed', telemetryProps);
    }

    private handleTestExecutionCountReport(event: TestExecutionCountReport) {
        if (event.debugCounts) {
            this.reporter.sendTelemetryEvent('DebugTest', null, event.debugCounts);
        }
        if (event.runCounts) {
            this.reporter.sendTelemetryEvent('RunTest', null, event.runCounts);
        }
    }

    private handleProjectConfigurationReceived(event: ProjectConfiguration, telemetryProps: { [key: string]: string }) {
        let projectConfig = event.projectConfiguration;
        telemetryProps['SolutionId'] = this.solutionId;
        telemetryProps['ProjectId'] = projectConfig.ProjectId;
        telemetryProps['SessionId'] = projectConfig.SessionId;
        telemetryProps['OutputType'] = projectConfig.OutputKind?.toString() ?? "";
        telemetryProps['ProjectCapabilities'] = projectConfig.ProjectCapabilities?.join(" ") ?? "";
        telemetryProps['TargetFrameworks'] = projectConfig.TargetFrameworks.join("|");
        telemetryProps['References'] = projectConfig.References.join("|");
        telemetryProps['FileExtensions'] = projectConfig.FileExtensions.join("|");
        telemetryProps['FileCounts'] = projectConfig.FileCounts?.join("|") ?? "";
        telemetryProps['NetSdkVersion'] = this.dotnetInfo?.Version ?? "";
        this.reporter.sendTelemetryEvent("ProjectConfiguration", telemetryProps);
    }

    private getTelemetryProps() {
        let telemetryProps: { [key: string]: string } = {
            'platform.architecture': this.platformInfo.architecture,
            'platform.platform': this.platformInfo.platform
        };

        if (this.platformInfo.distribution) {
            telemetryProps['platform.distribution'] = this.platformInfo.distribution.toTelemetryString();
        }

        return telemetryProps;
    }

    private createSolutionId(solutionPath: string) {
        const solutionHash = crypto.createHash('sha256').update(solutionPath).digest('hex');

        const machineId = machineIdSync();
        const machineHash = crypto.createHash('sha256').update(machineId).digest('hex');

        return crypto.createHash('sha256').update(solutionHash + machineHash).digest('hex');
    }
}
