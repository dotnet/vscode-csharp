/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as lsp from 'vscode-languageserver-protocol';

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
}

export interface RegisterSolutionSnapshotResponseItem {
    /**
     * Represents a solution snapshot.
     */
    id: lsp.integer;
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

export namespace ProjectInitializationCompleteNotification {
    export const method = 'workspace/projectInitializationComplete';
    export const messageDirection: lsp.MessageDirection = lsp.MessageDirection.serverToClient;
    export const type = new lsp.NotificationType(method);
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
