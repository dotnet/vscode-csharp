/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PlatformInformation } from "../platform";
import { Request } from "./requestQueue";
import * as protocol from './protocol';
import { IObserver } from "rx";

export interface BaseEvent{
}

export class TelemetryEventWithMeasures implements BaseEvent{
    constructor(public eventName: string, public measures: { [key: string]: number }) {
    }
}

export class OmnisharpDelayTrackerEventMeasures extends TelemetryEventWithMeasures {
}

export class OmnisharpStart extends TelemetryEventWithMeasures {
}

export class OmnisharpInitialisation implements BaseEvent{
    constructor(public timeStamp: Date, public solutionPath: string) { }
}

export class OmnisharpLaunch implements BaseEvent{
    constructor(public usingMono: boolean, public command: string, public pid: number) { }
}

export class PackageInstallation implements BaseEvent{
    constructor(public packageInfo: string) { }
}

export class PlatformInfoEvent implements BaseEvent{
    constructor(public info: PlatformInformation) { }
}

export class InstallationProgress implements BaseEvent{
    constructor(public stage: string, public message: string) { }
}

export class InstallationFailure implements BaseEvent{
    constructor(public stage: string,public error: any) { }
}

export class DownloadProgress implements BaseEvent{
    constructor(public downloadPercentage: number) { }
}

export class OmnisharpFailure implements BaseEvent{
    constructor(public message: string, error: Error) { }
}

export class OmnisharpRequestMessage implements BaseEvent{
    constructor(public request: Request, public id: number) { }
}

export class TestExecutionCountReport implements BaseEvent{
    constructor(public debugCounts: { [testFrameworkName: string]: number }, public runCounts: { [testFrameworkName: string]: number }) { }
}

export class OmnisharpServerOnError implements BaseEvent{
    constructor(public errorMessage: protocol.ErrorMessage) { }
}

export class OmnisharpServerMsBuildProjectDiagnostics implements BaseEvent{
    constructor(public diagnostics: protocol.MSBuildProjectDiagnostics) { }
}

export class OmnisharpServerUnresolvedDependencies implements BaseEvent{
    constructor(public unresolvedDependencies: protocol.UnresolvedDependenciesMessage) { }
}

export class OmnisharpServerEnqueueRequest implements BaseEvent{
    constructor(public name: string, public command: string) { }
}

export class OmnisharpServerDequeueRequest implements BaseEvent{
    constructor(public name: string, public command: string, public id: number) { }
}

export class OmnisharpServerProcessRequestStart implements BaseEvent{
    constructor(public name: string) { }
}

export class OmnisharpEventPacketReceived implements BaseEvent{
    constructor(public logLevel: string, public name: string, public message: string) { }
}

export class EventWithMessage implements BaseEvent{
    constructor(public message: string) { }
}

export class DebuggerPreRequisiteFailure extends EventWithMessage { }
export class DebuggerPreRequisiteWarning extends EventWithMessage { }
export class CommandDotNetRestoreProgress extends EventWithMessage { }
export class CommandDotNetRestoreSucceeded extends EventWithMessage { }
export class CommandDotNetRestoreFailed extends EventWithMessage { }
export class DownloadStart extends EventWithMessage { }
export class DownloadSuccess extends EventWithMessage { }
export class DownloadFailure extends EventWithMessage { }
export class OmnisharpServerOnStdErr extends EventWithMessage { }
export class OmnisharpServerMessage extends EventWithMessage { }
export class OmnisharpServerOnServerError extends EventWithMessage { }
export class OmnisharpServerVerboseMessage extends EventWithMessage { }


export class ActivationFailure implements BaseEvent{ }
export class CommandShowOutput implements BaseEvent{ }
export class DebuggerNotInstalledFailure implements BaseEvent{ }
export class CommandDotNetRestoreStart implements BaseEvent{ }
export class InstallationSuccess implements BaseEvent{ }
export class OmnisharpServerProcessRequestComplete implements BaseEvent{ }
export class ProjectJsonDeprecatedWarning implements BaseEvent{ }