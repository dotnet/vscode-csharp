/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum EventType {
    // TelemetryEvent = 1, No longer used.
    // TelemetryEventWithMeasures = 2, No longer used.
    PackageInstallStart = 6,
    PackageInstallation = 7,
    LogPlatformInfo = 8,
    InstallationStart = 9,
    InstallationFailure = 10,
    DownloadProgress = 11,
    // TestExecutionCountReport = 14, No longer used.
    // WorkspaceInformationUpdated = 23, No longer used.
    EventWithMessage = 24,
    DownloadStart = 25,
    DownloadFallBack = 26,
    DownloadSizeObtained = 27,
    ZipError = 28,
    // ReportDotNetTestResults = 29, No longer used.
    // DotNetTestRunStart = 30, No longer used.
    // DotNetTestDebugStart = 31, No longer used.
    // DotNetTestDebugProcessStart = 32, No longer used.
    // DotNetTestsInClassRunStart = 33, No longer used.
    // DotNetTestsInClassDebugStart = 34, No longer used.
    // DocumentSynchronizationFailure = 35, No longer used.
    IntegrityCheckFailure = 37,
    IntegrityCheckSuccess = 38,
    // RazorPluginPathSpecified = 39, No longer used.
    // RazorPluginPathDoesNotExist = 40, No longer used.
    DebuggerPrerequisiteFailure = 41,
    // CommandDotNetRestoreProgress = 42, No longer used.
    DownloadValidation = 43,
    // DotNetTestDebugComplete = 44, No longer used.
    // LatestBuildDownloadStart = 45, No longer used.
    // ActiveTextEditorChanged = 46, No longer used.
    // ProjectJsonDeprecatedWarning = 48, No longer used.
    InstallationSuccess = 50,
    // CommandDotNetRestoreStart = 51, No longer used.
    DebuggerNotInstalledFailure = 52,
    ActivationFailure = 54,
    // ProjectModified = 55, No longer used.
    // RazorDevModeActive = 56, No longer used.
    // DotNetTestDebugStartFailure = 57, No longer used.
    // DotNetTestDebugWarning = 58, No longer used.
    // DotNetTestRunFailure = 59, No longer used.
    // DotNetTestMessage = 60, No longer used.
    DownloadFailure = 64,
    DownloadSuccess = 65,
    // CommandDotNetRestoreSucceeded = 66, No longer used.
    DebuggerPrerequisiteWarning = 67,
    // CommandDotNetRestoreFailed = 68, No longer used.
    // ProjectConfigurationReceived = 74, No longer used.
    // ProjectDiagnosticStatus = 75, Obsolete, use BackgroundDiagnosticStatus
    // DotNetTestRunInContextStart = 76, No longer used.
    // DotNetTestDebugInContextStart = 77, No longer used.
    // TelemetryErrorEvent = 78, No longer used.
    // BackgroundDiagnosticStatus = 80, No longer used.
    // DevCertCreationFailure = 81, Removed as we push to output channel directly
    // ShowChannel = 82, No longer used.
}

// Event IDs are shared with Razor.VSCode. Preserve existing values and do not reuse retired IDs.
