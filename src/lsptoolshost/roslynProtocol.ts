/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Command } from 'vscode';
import * as lsp from 'vscode-languageserver-protocol';
import { CodeAction, TextDocumentRegistrationOptions } from 'vscode-languageserver-protocol';
import { ProjectConfigurationMessage } from '../shared/projectConfiguration';

export interface VSProjectContextList {
    _vs_projectContexts: VSProjectContext[];
    _vs_defaultIndex: number;
}

export interface VSProjectContext {
    _vs_label: string;
    _vs_id: string;
    _vs_kind: string;
}

export interface VSTextDocumentIdentifier extends lsp.TextDocumentIdentifier {
    _vs_projectContext: VSProjectContext | undefined;
}

export interface WorkspaceDebugConfigurationParams {
    /**
     * Workspace path containing the solution/projects to get debug information for.
     * This will be important eventually for multi-workspace support.
     * If not provided, configurations are returned for the workspace the server was initialized for.
     */
    workspacePath: lsp.URI | undefined;
}

export interface ProjectDebugConfiguration {
    /**
     * The absolute path to the project file.
     */
    projectPath: string;

    /**
     * The absolute path to the solution file.
     */
    solutionPath: string | null;

    /**
     * The absolute path to the output assembly dll.
     */
    outputPath: string;

    /**
     * User readable name of the project.  Includes information like TFM.
     */
    projectName: string;

    /**
     * If the project is targeting .net core.
     */
    targetsDotnetCore: boolean;

    /**
     * Whether the project is executable.
     */
    isExe: boolean;
}

export interface OnAutoInsertParams {
    _vs_textDocument: lsp.TextDocumentIdentifier;
    _vs_position: lsp.Position;
    _vs_ch: string;
    _vs_options: lsp.FormattingOptions;
}

export interface OnAutoInsertResponseItem {
    _vs_textEditFormat: lsp.InsertTextFormat;
    _vs_textEdit: lsp.TextEdit;

    /**
     * An optional command that is executed *after* inserting.
     */
    command?: Command;
}

/**
 * OnAutoInsert options.
 */
export interface OnAutoInsertOptions {
    /**
     * List of characters triggering an {@link OnAutoInsertRequest}.
     */
    _vs_triggerCharacters?: string[];
}

/**
 * Registration options for an {@link OnAutoInsertRequest}.
 */
export interface OnAutoInsertRegistrationOptions extends TextDocumentRegistrationOptions, OnAutoInsertOptions {}

export interface RegisterSolutionSnapshotResponseItem {
    /**
     * Represents a solution snapshot.
     */
    id: lsp.integer;
}

export interface VSGetProjectContextParams {
    /**
     * The document the project context is being requested for.
     */
    _vs_textDocument: lsp.TextDocumentIdentifier;
}

export interface RunTestsParams extends lsp.WorkDoneProgressParams, lsp.PartialResultParams {
    /**
     * The text document containing the tests to run.
     */
    textDocument: lsp.TextDocumentIdentifier;

    /**
     * The range encompasing the test methods to run.
     * Note that this does not have to only include tests, for example this could be a range representing a class.
     */
    range: lsp.Range;

    /**
     * Whether the request should attempt to call back to the client to attach a debugger before running the tests.
     */
    attachDebugger: boolean;

    /**
     * The absolute path to a .runsettings file to configure the test run.
     */
    runSettingsPath?: string;
}

export interface TestProgress {
    /**
     * The total number of tests passed at the time of the report.
     */
    testsPassed: number;
    /**
     * The total number of tests failed at the time of the report.
     */
    testsFailed: number;
    /**
     * The total number of tests skipped at the time of the report.
     */
    testsSkipped: number;
    /**
     * The total number of tests that will eventually be run.
     */
    totalTests: number;
}

export interface RunTestsPartialResult {
    stage: string;
    message: string;
    progress?: TestProgress;
}

export interface DebugAttachParams {
    processId: number;
}

export interface DebugAttachResult {
    didAttach: boolean;
}

export interface OpenSolutionParams {
    solution: lsp.DocumentUri;
}

export interface OpenProjectParams {
    projects: lsp.DocumentUri[];
}

export interface ShowToastNotificationParams {
    messageType: lsp.MessageType;
    message: string;
    commands: Command[];
}

export interface BuildOnlyDiagnosticIdsResult {
    ids: string[];
}

export interface RoslynFixAllCodeAction extends CodeAction {
    scope: string;
}

/**
 * Should match the definition on the server side, but only the properties we require on the client side.
 * https://github.com/dotnet/roslyn/blob/bd5c00e5e09de8564093f42d87fe49d4971f2e84/src/LanguageServer/Protocol/Handler/CodeActions/CodeActionResolveData.cs#L16C20-L16C41
 */
export interface CodeActionResolveData {
    UniqueIdentifier: string;
    FixAllFlavors?: string[];
}

export interface NamedPipeInformation {
    pipeName: string;
}

export interface RestoreParams extends lsp.WorkDoneProgressParams, lsp.PartialResultParams {
    /**
     * The set of projects to restore.
     * If none are specified, the solution (or all loaded projects) are restored.
     */
    projectFilePaths: string[];
}

export interface RestorePartialResult {
    stage: string;
    message: string;
}

export interface ProjectNeedsRestoreName {
    /**
     * The set of projects that have unresolved dependencies and require a restore.
     */
    projectFilePaths: string[];
}

export interface CopilotRelatedDocumentsParams extends lsp.WorkDoneProgressParams, lsp.PartialResultParams {
    _vs_textDocument: lsp.TextDocumentIdentifier;
    position: lsp.Position;
}

export interface CopilotRelatedDocumentsReport {
    _vs_file_paths?: string[];
}

export namespace WorkspaceDebugConfigurationRequest {
    export const method = 'workspace/debugConfiguration';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.RequestType<WorkspaceDebugConfigurationParams, ProjectDebugConfiguration[], void>(
        method
    );
}

export namespace OnAutoInsertRequest {
    export const method = 'textDocument/_vs_onAutoInsert';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.RequestType<OnAutoInsertParams, OnAutoInsertResponseItem, void>(method);
}

export namespace RegisterSolutionSnapshotRequest {
    export const method = 'workspace/_vs_registerSolutionSnapshot';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.RequestType0<RegisterSolutionSnapshotResponseItem, void>(method);
}

export namespace VSGetProjectContextsRequest {
    export const method = 'textDocument/_vs_getProjectContexts';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.RequestType<VSGetProjectContextParams, VSProjectContextList, void>(method);
}

export namespace ProjectInitializationCompleteNotification {
    export const method = 'workspace/projectInitializationComplete';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.serverToClient;
    export const type = new lsp.NotificationType(method);
}

export namespace ProjectConfigurationNotification {
    export const method = 'workspace/projectConfigurationTelemetry';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.serverToClient;
    export const type = new lsp.NotificationType<ProjectConfigurationMessage>(method);
}

export namespace ShowToastNotification {
    export const method = 'window/_roslyn_showToast';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.serverToClient;
    export const type = new lsp.NotificationType<ShowToastNotificationParams>(method);
}

export namespace RunTestsRequest {
    export const method = 'textDocument/runTests';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.ProtocolRequestType<
        RunTestsParams,
        RunTestsPartialResult[],
        RunTestsPartialResult,
        void,
        void
    >(method);
}

export namespace DebugAttachRequest {
    export const method = 'workspace/attachDebugger';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.serverToClient;
    export const type = new lsp.RequestType<DebugAttachParams, DebugAttachResult, void>(method);
}

export namespace OpenSolutionNotification {
    export const method = 'solution/open';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.NotificationType<OpenSolutionParams>(method);
}

export namespace OpenProjectNotification {
    export const method = 'project/open';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.NotificationType<OpenProjectParams>(method);
}

export namespace BuildOnlyDiagnosticIdsRequest {
    export const method = 'workspace/buildOnlyDiagnosticIds';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.RequestType0<BuildOnlyDiagnosticIdsResult, void>(method);
}

export namespace CodeActionFixAllResolveRequest {
    export const method = 'codeAction/resolveFixAll';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.RequestType<RoslynFixAllCodeAction, RoslynFixAllCodeAction, void>(method);
}

export namespace RestoreRequest {
    export const method = 'workspace/_roslyn_restore';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.ProtocolRequestType<
        RestoreParams,
        RestorePartialResult[],
        RestorePartialResult,
        void,
        void
    >(method);
}

export namespace RestorableProjects {
    export const method = 'workspace/_roslyn_restorableProjects';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.RequestType0<string[], void>(method);
}

export namespace ProjectNeedsRestoreRequest {
    export const method = 'workspace/_roslyn_projectNeedsRestore';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.serverToClient;
    export const type = new lsp.RequestType<ProjectNeedsRestoreName, void, void>(method);
}

export namespace CopilotRelatedDocumentsRequest {
    export const method = 'copilot/_related_documents';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.clientToServer;
    export const type = new lsp.ProtocolRequestType<
        CopilotRelatedDocumentsParams,
        CopilotRelatedDocumentsReport[],
        CopilotRelatedDocumentsReport[],
        void,
        void
    >(method);
}
