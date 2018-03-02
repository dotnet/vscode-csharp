/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IObserver } from "rx";
import { PackageError } from "../packages";
import { PlatformInformation } from "../platform";
import { Request } from "./requestQueue";
import * as protocol from './protocol';

export type MessageObserver = IObserver<Message>;
export enum MessageType {
    ActivationFailure,
    CommandShowOutput,
    CommandDotNetRestoreStart,
    CommandDotNetRestoreProgress,
    CommandDotNetRestoreSucceeded,
    CommandDotNetRestoreFailed,
    DebuggerNotInstalledFailure,
    DebuggerPreRequisiteFailure,
    DebuggerPreRequisiteWarning,
    DownloadEnd,
    DownloadProgress, 
    DownloadStart, 
    InstallationFailure,
    InstallationSuccess, 
    InstallationProgress, 
    OmnisharpDelayTrackerEventMeasures,
    OmnisharpEventPacketReceived, 
    OmnisharpFailure,
    OmnisharpInitialisation,
    OmnisharpLaunch,
    OmnisharpRequestMessage,
    OmnisharpServerOnServerError,
    OmnisharpServerOnError,
    OmnisharpServerOnStdErr,
    OmnisharpServerMsBuildProjectDiagnostics,
    OmnisharpServerUnresolvedDependencies,
    OmnisharpServerMessage, 
    OmnisharpServerVerboseMessage,
    OmnisharpStart,
    PackageInstallation,
    Platform,
    ProjectJsonDeprecatedWarning,
    TestExecutionCountReport,
}
export type Message = 
    Action |
    ActionWithMessage |
    InstallationStep |
    InstallationFailure |
    TelemetryEventWithMeasures |
    OmnisharpEventPacketReceived |
    OmnisharpFailure |
    OmnisharpInitialisation |
    OmnisharpLaunch |
    OmnisharpServerMsBuildProjectDiagnostics |
    OmnisharpServerUnresolvedDependencies |
    OmnisharpRequestMessage |
    OmnisharpServerOnError |
    PackageInstallation |
    Platform |
    TestExecutionCountReport;

interface Action {
    type: MessageType.ActivationFailure |
          MessageType.CommandShowOutput |
          MessageType.DebuggerNotInstalledFailure |
          MessageType.CommandDotNetRestoreStart |
          MessageType.InstallationSuccess |
          MessageType.ProjectJsonDeprecatedWarning;
}

interface ActionWithMessage {
    type: MessageType.DebuggerPreRequisiteFailure |
          MessageType.DebuggerPreRequisiteWarning |
          MessageType.CommandDotNetRestoreProgress |
          MessageType.CommandDotNetRestoreSucceeded |
          MessageType.CommandDotNetRestoreFailed |
          MessageType.DownloadStart | 
          MessageType.DownloadProgress | 
          MessageType.DownloadEnd |
          MessageType.OmnisharpServerOnStdErr |
          MessageType.OmnisharpServerMessage |
          MessageType.OmnisharpServerOnServerError |
          MessageType.OmnisharpServerVerboseMessage;
    message: string;
}

interface TelemetryEventWithMeasures {
    type: MessageType.OmnisharpDelayTrackerEventMeasures |
          MessageType.OmnisharpStart;
    eventName: string;
    measures: { [key: string]: number } ;
}
interface OmnisharpInitialisation {
    type: MessageType.OmnisharpInitialisation;
    timeStamp: Date;
    solutionPath: string;
}

interface OmnisharpLaunch {
    type: MessageType.OmnisharpLaunch;
    usingMono: boolean;
    command: string;
    pid: number;
}

interface PackageInstallation {
    type: MessageType.PackageInstallation;
    packageInfo: string;
}

interface Platform {
    type: MessageType.Platform;
    info: PlatformInformation;
}

interface InstallationStep {
    type: MessageType.InstallationProgress;
    stage: string;
    message: string;
}

interface InstallationFailure {
    type: MessageType.InstallationFailure;
    stage: string;
    error: any;
}

interface OmnisharpFailure {
    type: MessageType.OmnisharpFailure;
    message: string;
    error: Error;
}

interface OmnisharpRequestMessage {
    type: MessageType.OmnisharpRequestMessage;
    request: Request;
    id: number;
}

interface TestExecutionCountReport {
    type: MessageType.TestExecutionCountReport;
    debugCounts: { [testFrameworkName: string]: number };
    runCounts: { [testFrameworkName: string]: number };
}

interface OmnisharpServerOnError {
    type: MessageType.OmnisharpServerOnError;
    errorMessage: protocol.ErrorMessage;
}

interface OmnisharpServerMsBuildProjectDiagnostics {
    type: MessageType.OmnisharpServerMsBuildProjectDiagnostics;
    diagnostics: protocol.MSBuildProjectDiagnostics;
}

interface OmnisharpServerUnresolvedDependencies {
    type: MessageType.OmnisharpServerUnresolvedDependencies;
    unresolvedDependencies: protocol.UnresolvedDependenciesMessage;
}

export interface OmnisharpEventPacketReceived {
    type: MessageType.OmnisharpEventPacketReceived;
    logLevel: string;
    name: string;
    message: string;
}
