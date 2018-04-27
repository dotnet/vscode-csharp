/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { Request } from "./requestQueue";
import * as protocol from './protocol';
import { LaunchTarget } from "./launcher";

export interface BaseEvent {
}

export class TelemetryEventWithMeasures implements BaseEvent {
    constructor(public eventName: string, public measures: { [key: string]: number }) {
    }
}

export class OmnisharpDelayTrackerEventMeasures extends TelemetryEventWithMeasures {
}

export class OmnisharpStart extends TelemetryEventWithMeasures {
}

export class OmnisharpInitialisation implements BaseEvent {
    constructor(public timeStamp: Date, public solutionPath: string) { }
}

export class OmnisharpLaunch implements BaseEvent {
    constructor(public monoVersion: string, public command: string, public pid: number) { }
}

export class PackageInstallation implements BaseEvent {
    constructor(public packageInfo: string) { }
}

export class LogPlatformInfo implements BaseEvent {
    constructor(public info: PlatformInformation) { }
}

export class InstallationStart implements BaseEvent {
    constructor(public packageDescription: string) { }
}

export class InstallationFailure implements BaseEvent {
    constructor(public stage: string, public error: any) { }
}

export class DownloadProgress implements BaseEvent {
    constructor(public downloadPercentage: number, public packageDescription: string) { }
}

export class OmnisharpFailure implements BaseEvent {
    constructor(public message: string, public error: Error) { }
}

export class OmnisharpRequestMessage implements BaseEvent {
    constructor(public request: Request, public id: number) { }
}

export class TestExecutionCountReport implements BaseEvent {
    constructor(public debugCounts: { [testFrameworkName: string]: number }, public runCounts: { [testFrameworkName: string]: number }) { }
}

export class OmnisharpServerOnError implements BaseEvent {
    constructor(public errorMessage: protocol.ErrorMessage) { }
}

export class OmnisharpServerMsBuildProjectDiagnostics implements BaseEvent {
    constructor(public diagnostics: protocol.MSBuildProjectDiagnostics) { }
}

export class OmnisharpServerUnresolvedDependencies implements BaseEvent {
    constructor(public unresolvedDependencies: protocol.UnresolvedDependenciesMessage) { }
}

export class OmnisharpServerEnqueueRequest implements BaseEvent {
    constructor(public name: string, public command: string) { }
}

export class OmnisharpServerDequeueRequest implements BaseEvent {
    constructor(public name: string, public command: string, public id: number) { }
}

export class OmnisharpServerProcessRequestStart implements BaseEvent {
    constructor(public name: string) { }
}

export class OmnisharpEventPacketReceived implements BaseEvent {
    constructor(public logLevel: string, public name: string, public message: string) { }
}

export class OmnisharpServerOnServerError implements BaseEvent {
    constructor(public err: any) { }
}

export class OmnisharpOnMultipleLaunchTargets implements BaseEvent {
    constructor(public targets: LaunchTarget[]) { }
}

export class WorkspaceInformationUpdated implements BaseEvent {
    constructor(public info: protocol.WorkspaceInformationResponse) { }
}

export class EventWithMessage implements BaseEvent {
    constructor(public message: string) { }
}

export class DownloadStart implements BaseEvent {
    constructor(public packageDescription: string) { }
}

export class DownloadFallBack implements BaseEvent {
    constructor(public fallbackUrl: string) { }
}

export class DownloadSizeObtained implements BaseEvent {
    constructor(public packageSize: number) { }
}

export class DebuggerPrerequisiteFailure extends EventWithMessage { }
export class DebuggerPrerequisiteWarning extends EventWithMessage { }
export class CommandDotNetRestoreProgress extends EventWithMessage { }
export class CommandDotNetRestoreSucceeded extends EventWithMessage { }
export class CommandDotNetRestoreFailed extends EventWithMessage { }
export class DownloadSuccess extends EventWithMessage { }
export class DownloadFailure extends EventWithMessage { }
export class OmnisharpServerOnStdErr extends EventWithMessage { }
export class OmnisharpServerMessage extends EventWithMessage { }
export class OmnisharpServerVerboseMessage extends EventWithMessage { }

export class ProjectModified implements BaseEvent { }
export class ActivationFailure implements BaseEvent { }
export class CommandShowOutput implements BaseEvent { }
export class DebuggerNotInstalledFailure implements BaseEvent { }
export class CommandDotNetRestoreStart implements BaseEvent { }
export class InstallationSuccess implements BaseEvent { }
export class OmnisharpServerProcessRequestComplete implements BaseEvent { }
export class ProjectJsonDeprecatedWarning implements BaseEvent { }
export class OmnisharpOnBeforeServerStart implements BaseEvent { }
export class OmnisharpOnBeforeServerInstall implements BaseEvent { }
export class ActiveTextEditorChanged implements BaseEvent { }
export class OmnisharpServerOnStop implements BaseEvent { }
export class OmnisharpServerOnStart implements BaseEvent { }
export class LatestBuildDownloadStart implements BaseEvent { }