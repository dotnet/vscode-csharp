/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from '../../shared/platform';
import { BaseEvent, InstallationFailure } from '../../shared/loggingEvents';
import {
    TestExecutionCountReport,
    TelemetryEventWithMeasures,
    TelemetryEvent,
    ProjectConfiguration,
    TelemetryErrorEvent,
    OmnisharpInitialisation,
} from '../omnisharpLoggingEvents';
import { PackageError } from '../../packageManager/packageError';
import { EventType } from '../../shared/eventType';
import { getDotnetInfo } from '../../shared/utils/getDotnetInfo';
import { DotnetInfo } from '../../shared/utils/dotnetInfo';
import { ITelemetryReporter, getTelemetryProps } from '../../shared/telemetryReporter';
import { reportProjectConfigurationEvent } from '../../shared/projectConfiguration';

export class TelemetryObserver {
    private reporter: ITelemetryReporter;
    private platformInfo: PlatformInformation;
    private solutionPath?: string;
    private dotnetInfo?: DotnetInfo;
    private useModernNet: boolean;

    constructor(platformInfo: PlatformInformation, reporterCreator: () => ITelemetryReporter, useModernNet: boolean) {
        this.platformInfo = platformInfo;
        this.reporter = reporterCreator();
        this.useModernNet = useModernNet;
    }

    public post = (event: BaseEvent) => {
        const telemetryProps = getTelemetryProps(this.platformInfo);
        switch (event.type) {
            case EventType.OmnisharpInitialisation:
                this.handleOmnisharpInitialisation(<OmnisharpInitialisation>event);
                break;
            case EventType.PackageInstallation:
                this.reporter.sendTelemetryEvent('AcquisitionStart');
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
            case EventType.TelemetryEvent: {
                const telemetryEvent = <TelemetryEvent>event;
                this.reporter.sendTelemetryEvent(
                    telemetryEvent.eventName,
                    telemetryEvent.properties,
                    telemetryEvent.measures
                );
                break;
            }
            case EventType.TelemetryErrorEvent: {
                const telemetryErrorEvent = <TelemetryErrorEvent>event;
                this.reporter.sendTelemetryErrorEvent(
                    telemetryErrorEvent.eventName,
                    telemetryErrorEvent.properties,
                    telemetryErrorEvent.measures,
                    telemetryErrorEvent.errorProps
                );
                break;
            }
            case EventType.ProjectConfigurationReceived:
                this.handleProjectConfigurationReceived(<ProjectConfiguration>event);
                break;
        }
    };

    private handleTelemetryEventMeasures(event: TelemetryEventWithMeasures) {
        this.reporter.sendTelemetryEvent(event.eventName, undefined, event.measures);
    }

    private async handleOmnisharpInitialisation(event: OmnisharpInitialisation) {
        this.dotnetInfo = await getDotnetInfo(event.dotNetCliPaths);
        this.solutionPath = event.solutionPath;
    }

    private handleInstallationSuccess(telemetryProps: { [key: string]: string }) {
        telemetryProps['installStage'] = 'completeSuccess';
        this.reporter.sendTelemetryEvent('AcquisitionSucceeded', telemetryProps);
    }

    private handleInstallationFailure(event: InstallationFailure, telemetryProps: { [key: string]: string }) {
        telemetryProps['installStage'] = event.stage;
        if (event.error instanceof PackageError) {
            // we can log the message in a PackageError to telemetry as we do not put PII in PackageError messages
            telemetryProps['error.message'] = event.error.message;
            telemetryProps['error.packageUrl'] = event.error.pkg.url;
        }

        this.reporter.sendTelemetryEvent('AcquisitionFailed', telemetryProps);
    }

    private handleTestExecutionCountReport(event: TestExecutionCountReport) {
        if (event.debugCounts) {
            this.reporter.sendTelemetryEvent('DebugTest', undefined, event.debugCounts);
        }
        if (event.runCounts) {
            this.reporter.sendTelemetryEvent('RunTest', undefined, event.runCounts);
        }
    }

    private handleProjectConfigurationReceived(event: ProjectConfiguration) {
        const projectConfig = event.projectConfiguration;
        reportProjectConfigurationEvent(
            this.reporter,
            projectConfig,
            this.platformInfo,
            this.dotnetInfo,
            this.solutionPath ?? '',
            this.useModernNet
        );
    }
}
