/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageType, Message } from "../../../src/omnisharp/messageType";
import { MSBuildDiagnosticsMessage } from "../../../src/omnisharp/protocol";

export const CommandDotNetRestoreStart = () => ({
    type: MessageType.CommandDotNetRestoreStart
});

export const DisplayMessageType = (value: Message): string => {
    return MessageType[value.type];
};

export const CommandDotNetRestoreProgress = (message: string): Message => ({
    type: MessageType.CommandDotNetRestoreProgress,
    message
});

export const CommandDotNetRestoreSucceeded = (message: string): Message => ({
    type: MessageType.CommandDotNetRestoreSucceeded,
    message
});

export const CommandDotNetRestoreFailed = (message: string): Message => ({
    type: MessageType.CommandDotNetRestoreFailed,
    message
});

export const DownloadStart = (message: string): Message => ({
    type: MessageType.DownloadStart,
   message 
});

export const DownloadProgress = (downloadPercentage: number): Message => ({
    type: MessageType.DownloadProgress,
    downloadPercentage
});

export const DownloadSuccess = (message: string): Message => ({
    type: MessageType.DownloadSuccess,
    message
});

export const DownloadFailure = (message: string): Message => ({
    type: MessageType.DownloadFailure,
    message
});

export const InstallationFailure = (stage: string, error: any): Message => ({
    type: MessageType.InstallationFailure,
    stage,
    error
});

export const DebuggerPreRequisiteFailure = (message: string): Message => ({
    type: MessageType.DebuggerPreRequisiteFailure,
    message
});

export const DebuggerPreRequisiteWarning = (message: string): Message => ({
    type: MessageType.DebuggerPreRequisiteWarning,
    message
});

export const PackageInstallation = (packageInfo: string): Message => ({
    type: MessageType.PackageInstallation,
    packageInfo
});

export const DebuggerNotInstalledFailure = (): Message => ({
    type: MessageType.DebuggerNotInstalledFailure,
});

export const ProjectJsonDeprecatedWarning = (): Message => ({
    type: MessageType.ProjectJsonDeprecatedWarning,
});

export const OmnisharpFailure = (message: string, error: any): Message => ({
    type: MessageType.OmnisharpFailure,
    message,
    error
});

export const OmnisharpServerMsBuildProjectDiagnostics = (FileName: string, Warnings: MSBuildDiagnosticsMessage[], Errors: MSBuildDiagnosticsMessage[]): Message => ({
    type: MessageType.OmnisharpServerMsBuildProjectDiagnostics,
    diagnostics: {
        FileName,
        Warnings,
        Errors
    }
});
