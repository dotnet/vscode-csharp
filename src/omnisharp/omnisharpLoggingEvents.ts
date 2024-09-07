/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Request } from './requestQueue';
import * as protocol from './protocol';
import { LaunchTarget } from '../shared/launchTarget';
import { EventType } from '../shared/eventType';
import { ProjectConfigurationMessage } from '../shared/projectConfiguration';
import { BaseEvent, EventWithMessage } from '../shared/loggingEvents';

export class TelemetryEvent implements BaseEvent {
    type = EventType.TelemetryEvent;
    constructor(
        public eventName: string,
        public properties?: { [key: string]: string },
        public measures?: { [key: string]: number }
    ) {}
}

export class TelemetryErrorEvent implements BaseEvent {
    type = EventType.TelemetryErrorEvent;
    constructor(
        public eventName: string,
        public properties?: { [key: string]: string },
        public measures?: { [key: string]: number },
        public errorProps?: string[]
    ) {}
}

export class TelemetryEventWithMeasures implements BaseEvent {
    type = EventType.TelemetryEvent;
    constructor(public eventName: string, public measures: { [key: string]: number }) {}
}

export class OmnisharpDelayTrackerEventMeasures extends TelemetryEventWithMeasures {
    type = EventType.OmnisharpDelayTrackerEventMeasures;
}

export class OmnisharpStart extends TelemetryEventWithMeasures {
    type = EventType.OmnisharpStart;
}

export class OmnisharpInitialisation implements BaseEvent {
    type = EventType.OmnisharpInitialisation;
    constructor(public dotNetCliPaths: string[], public timeStamp: Date, public solutionPath: string) {}
}

export class OmnisharpLaunch implements BaseEvent {
    type = EventType.OmnisharpLaunch;
    constructor(
        public hostVersion: string | undefined,
        public hostPath: string | undefined,
        public hostIsMono: boolean,
        public command: string,
        public pid: number
    ) {}
}

export class OmnisharpFailure implements BaseEvent {
    type = EventType.OmnisharpFailure;
    constructor(public message: string, public error: Error) {}
}

export class OmnisharpRequestMessage implements BaseEvent {
    type = EventType.OmnisharpRequestMessage;
    constructor(public request: Request, public id: number) {}
}

export class TestExecutionCountReport implements BaseEvent {
    type = EventType.TestExecutionCountReport;
    constructor(
        public debugCounts: { [testFrameworkName: string]: number } | undefined,
        public runCounts: { [testFrameworkName: string]: number } | undefined
    ) {}
}

export class OmnisharpServerOnError implements BaseEvent {
    type = EventType.OmnisharpServerOnError;
    constructor(public errorMessage: protocol.ErrorMessage) {}
}

export class OmnisharpBackgroundDiagnosticStatus implements BaseEvent {
    type = EventType.BackgroundDiagnosticStatus;
    constructor(public message: protocol.BackgroundDiagnosticStatusMessage) {}
}

export class OmnisharpServerMsBuildProjectDiagnostics implements BaseEvent {
    type = EventType.OmnisharpServerMsBuildProjectDiagnostics;
    constructor(public diagnostics: protocol.MSBuildProjectDiagnostics) {}
}

export class OmnisharpServerUnresolvedDependencies implements BaseEvent {
    type = EventType.OmnisharpServerUnresolvedDependencies;
    constructor(public unresolvedDependencies: protocol.UnresolvedDependenciesMessage) {}
}

export class OmnisharpServerEnqueueRequest implements BaseEvent {
    type = EventType.OmnisharpServerEnqueueRequest;
    constructor(public queueName: string, public command: string) {}
}

export class OmnisharpServerDequeueRequest implements BaseEvent {
    type = EventType.OmnisharpServerDequeueRequest;
    constructor(public queueName: string, public queueStatus: string, public command: string, public id?: number) {}
}

export class OmnisharpServerRequestCancelled implements BaseEvent {
    type = EventType.OmnisharpServerRequestCancelled;
    constructor(public command: string, public id: number | undefined) {}
}

export class OmnisharpServerProcessRequestStart implements BaseEvent {
    type = EventType.OmnisharpServerProcessRequestStart;
    constructor(public name: string, public availableRequestSlots: number) {}
}

export class OmnisharpEventPacketReceived implements BaseEvent {
    type = EventType.OmnisharpEventPacketReceived;
    constructor(public logLevel: string, public name: string, public message: string) {}
}

export class OmnisharpServerOnServerError implements BaseEvent {
    type = EventType.OmnisharpServerOnServerError;
    constructor(public err: any) {}
}

export class OmnisharpOnMultipleLaunchTargets implements BaseEvent {
    type = EventType.OmnisharpOnMultipleLaunchTargets;
    constructor(public targets: LaunchTarget[]) {}
}

export class ProjectConfiguration implements BaseEvent {
    type = EventType.ProjectConfigurationReceived;
    constructor(public projectConfiguration: ProjectConfigurationMessage) {}
}

export class WorkspaceInformationUpdated implements BaseEvent {
    type = EventType.WorkspaceInformationUpdated;
    constructor(public info: protocol.WorkspaceInformationResponse) {}
}

export class ReportDotNetTestResults implements BaseEvent {
    type = EventType.ReportDotNetTestResults;
    constructor(public results: protocol.V2.DotNetTestResult[] | undefined) {}
}

export class DotNetTestRunStart implements BaseEvent {
    type = EventType.DotNetTestRunStart;
    constructor(public testMethod: string) {}
}

export class DotNetTestDebugStart implements BaseEvent {
    type = EventType.DotNetTestDebugStart;
    constructor(public testMethod: string) {}
}

export class DotNetTestDebugProcessStart implements BaseEvent {
    type = EventType.DotNetTestDebugProcessStart;
    constructor(public targetProcessId: number) {}
}

export class DotNetTestsInClassRunStart implements BaseEvent {
    type = EventType.DotNetTestsInClassRunStart;
    constructor(public className: string) {}
}

export class DotNetTestsInClassDebugStart implements BaseEvent {
    type = EventType.DotNetTestsInClassDebugStart;
    constructor(public className: string) {}
}

export class DotNetTestRunInContextStart implements BaseEvent {
    type = EventType.DotNetTestRunInContextStart;
    constructor(public fileName: string, public line: number, public column: number) {}
}

export class DotNetTestDebugInContextStart implements BaseEvent {
    type = EventType.DotNetTestDebugInContextStart;
    constructor(public fileName: string, public line: number, public column: number) {}
}

export class DocumentSynchronizationFailure implements BaseEvent {
    type = EventType.DocumentSynchronizationFailure;
    constructor(public documentPath: string, public errorMessage: string) {}
}

export class RazorPluginPathSpecified implements BaseEvent {
    type = EventType.RazorPluginPathSpecified;
    constructor(public path: string) {}
}

export class RazorPluginPathDoesNotExist implements BaseEvent {
    type = EventType.RazorPluginPathDoesNotExist;
    constructor(public path: string) {}
}

export class CommandDotNetRestoreProgress extends EventWithMessage {
    type = EventType.CommandDotNetRestoreProgress;
}

export class CommandDotNetRestoreSucceeded extends EventWithMessage {
    type = EventType.CommandDotNetRestoreSucceeded;
}

export class CommandDotNetRestoreFailed extends EventWithMessage {
    type = EventType.CommandDotNetRestoreFailed;
}

export class OmnisharpServerOnStdErr extends EventWithMessage {
    type = EventType.OmnisharpServerOnStdErr;
}

export class OmnisharpServerMessage extends EventWithMessage {
    type = EventType.OmnisharpServerMessage;
}

export class OmnisharpServerVerboseMessage extends EventWithMessage {
    type = EventType.OmnisharpServerVerboseMessage;
}

export class DotNetTestMessage extends EventWithMessage {
    type = EventType.DotNetTestMessage;
}

export class DotNetTestRunFailure extends EventWithMessage {
    type = EventType.DotNetTestRunFailure;
}

export class DotNetTestDebugWarning extends EventWithMessage {
    type = EventType.DotNetTestDebugWarning;
}

export class DotNetTestDebugStartFailure extends EventWithMessage {
    type = EventType.DotNetTestDebugStartFailure;
}

export class RazorDevModeActive implements BaseEvent {
    type = EventType.RazorDevModeActive;
}

export class ProjectModified implements BaseEvent {
    type = EventType.ProjectModified;
}

export class ShowOmniSharpChannel implements BaseEvent {
    type = EventType.ShowOmniSharpChannel;
}

export class CommandDotNetRestoreStart implements BaseEvent {
    type = EventType.CommandDotNetRestoreStart;
}

export class OmnisharpServerProcessRequestComplete implements BaseEvent {
    type = EventType.OmnisharpServerProcessRequestComplete;
}

export class ProjectJsonDeprecatedWarning implements BaseEvent {
    type = EventType.ProjectJsonDeprecatedWarning;
}

export class OmnisharpOnBeforeServerStart implements BaseEvent {
    type = EventType.OmnisharpOnBeforeServerStart;
}

export class OmnisharpOnBeforeServerInstall implements BaseEvent {
    type = EventType.OmnisharpOnBeforeServerInstall;
}

export class ActiveTextEditorChanged implements BaseEvent {
    type = EventType.ActiveTextEditorChanged;
}

export class OmnisharpServerOnStop implements BaseEvent {
    type = EventType.OmnisharpServerOnStop;
}

export class OmnisharpServerOnStart implements BaseEvent {
    type = EventType.OmnisharpServerOnStart;
}

export class LatestBuildDownloadStart implements BaseEvent {
    type = EventType.LatestBuildDownloadStart;
}

export class OmnisharpRestart implements BaseEvent {
    type = EventType.OmnisharpRestart;
}

export class DotNetTestDebugComplete implements BaseEvent {
    type = EventType.DotNetTestDebugComplete;
}

export class ShowChannel implements BaseEvent {
    type = EventType.ShowChannel;
}
