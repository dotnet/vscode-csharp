/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { BaseEvent, InstallationFailure, TestExecutionCountReport, TelemetryEventWithMeasures, TelemetryEvent, ProjectConfiguration} from "../omnisharp/loggingEvents";
import { PackageError } from "../packageManager/PackageError";
import { EventType } from "../omnisharp/EventType";

export interface ITelemetryReporter {
    sendTelemetryEvent(eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }): void;
}

export class TelemetryObserver {
    private reporter: ITelemetryReporter;
    private platformInfo: PlatformInformation;

    constructor(platformInfo: PlatformInformation, reporterCreator: () => ITelemetryReporter) {
        this.platformInfo = platformInfo;
        this.reporter = reporterCreator();
    }

    public post = (event: BaseEvent) => {
        let telemetryProps = this.getTelemetryProps();
        switch (event.type) {
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
            case EventType.ProjectConfigurationReceived:
                let projectConfig = (<ProjectConfiguration>event).projectConfiguration;
                telemetryProps['ProjectFilePath'] = projectConfig.ProjectFilePath;
                telemetryProps['TargetFramework'] = projectConfig.TargetFramework;
                this.reporter.sendTelemetryEvent("ProjectConfiguration", telemetryProps);
                break;
        }
    }

    private handleTelemetryEventMeasures(event: TelemetryEventWithMeasures) {
        this.reporter.sendTelemetryEvent(event.eventName, null, event.measures);
    }

    private handleInstallationSuccess(telemetryProps: { [key: string]: string; }) {
        telemetryProps['installStage'] = 'completeSuccess';
        this.reporter.sendTelemetryEvent('Acquisition', telemetryProps);
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

        this.reporter.sendTelemetryEvent('Acquisition', telemetryProps);
    }

    private handleTestExecutionCountReport(event: TestExecutionCountReport) {
        if (event.debugCounts) {
            this.reporter.sendTelemetryEvent('DebugTest', null, event.debugCounts);
        }
        if (event.runCounts) {
            this.reporter.sendTelemetryEvent('RunTest', null, event.runCounts);
        }
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
}
