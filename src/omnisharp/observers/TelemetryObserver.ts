/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Message, MessageType } from "../messageType";
import { PackageError } from "../../packages";
import { PlatformInformation } from "../../platform";

export interface ITelemetryReporter {
    sendTelemetryEvent(eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }): void;
}

export class TelemetryObserver {
    onError(exception: any): void {
        throw new Error("Method not implemented.");
    }
    onCompleted(): void {
        throw new Error("Method not implemented.");
    }

    private reporter: ITelemetryReporter;
    private platformInfo: PlatformInformation;

    constructor(platformInfo: PlatformInformation, reporterCreator: () => ITelemetryReporter) {
        this.platformInfo = platformInfo;
        this.reporter = reporterCreator();
    }

    public onNext = (message: Message) => {
        let telemetryProps = this.getTelemetryProps();

        switch (message.type) {
            case MessageType.PackageInstallation:
                this.reporter.sendTelemetryEvent("AcquisitionStart");
                break;
            case MessageType.InstallationFailure:
                telemetryProps['installStage'] = message.stage;
                
                if (message.error instanceof PackageError) {
                    // we can log the message in a PackageError to telemetry as we do not put PII in PackageError messages
                    telemetryProps['error.message'] = message.error.message;
                    
                    if (message.error.pkg) {
                        telemetryProps['error.packageUrl'] = message.error.pkg.url;
                    }
                }
                
                this.reporter.sendTelemetryEvent('Acquisition', telemetryProps);
                break;
            case MessageType.InstallationSuccess:            
                telemetryProps['installStage'] = 'completeSuccess';
                this.reporter.sendTelemetryEvent('Acquisition', telemetryProps);
                break;
            case MessageType.OmnisharpDelayTrackerEventMeasures:
            case MessageType.OmnisharpStart:
                this.reporter.sendTelemetryEvent(message.eventName, null, message.measures);
                break;
            case MessageType.TestExecutionCountReport:
                if (message.debugCounts) {
                    this.reporter.sendTelemetryEvent('DebugTest', null, message.debugCounts);
                }
                if (message.runCounts){
                    this.reporter.sendTelemetryEvent('RunTest', null, message.runCounts);
                }
                break;
            case MessageType.OmnisharpStart:
                this.reporter.sendTelemetryEvent('OmniSharp.Start', null, message.measures);
                break;
        }
    }

    private getTelemetryProps() {
        let telemetryProps = {
            'platform.architecture': this.platformInfo.architecture,
            'platform.platform': this.platformInfo.platform
        };

        if (this.platformInfo.distribution) {
            telemetryProps['platform.distribution'] = this.platformInfo.distribution.toTelemetryString();
        }

        return telemetryProps;
    }
}
