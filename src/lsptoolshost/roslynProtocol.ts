/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FormattingOptions, InsertTextFormat, MessageDirection, NotificationType, Position, RequestType, RequestType0, TextDocumentIdentifier, TextEdit, URI, integer } from "vscode-languageserver-protocol";

export declare namespace RoslynProtocol {
    export interface WorkspaceDebugConfigurationParams {
        /**
         * Workspace path containing the solution/projects to get debug information for.
         * This will be important eventually for multi-workspace support.
         * If not provided, configurations are returned for the workspace the server was initialized for.
         */
        workspacePath: URI | undefined;
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
        _vs_textDocument: TextDocumentIdentifier;
        _vs_position: Position;
        _vs_ch: string;
        _vs_options: FormattingOptions;
    }

    export interface OnAutoInsertResponseItem {
        _vs_textEditFormat: InsertTextFormat;
        _vs_textEdit: TextEdit;
    }

    export interface RegisterSolutionSnapshotResponseItem {
        /**
         * Represents a solution snapshot.
        */
        id: integer;
    }
}

export namespace WorkspaceDebugConfigurationRequest {
    export const method: 'workspace/debugConfiguration' = 'workspace/debugConfiguration';
    export const messageDirection: MessageDirection = MessageDirection.clientToServer;
    export const type = new RequestType<RoslynProtocol.WorkspaceDebugConfigurationParams, RoslynProtocol.ProjectDebugConfiguration[], void>(method);
}

export namespace OnAutoInsertRequest {
    export const method: 'textDocument/_vs_onAutoInsert' = 'textDocument/_vs_onAutoInsert';
    export const messageDirection: MessageDirection = MessageDirection.clientToServer;
    export const type = new RequestType<RoslynProtocol.OnAutoInsertParams, RoslynProtocol.OnAutoInsertResponseItem, void>(method);
}

export namespace RegisterSolutionSnapshotRequest {
    export const method: 'workspace/_vs_registerSolutionSnapshot' = 'workspace/_vs_registerSolutionSnapshot';
    export const messageDirection: MessageDirection = MessageDirection.clientToServer;
    export const type = new RequestType0<RoslynProtocol.RegisterSolutionSnapshotResponseItem, void>(method);
}

export namespace ProjectInitializationCompleteNotification {
    export const method: 'workspace/projectInitializationComplete' = 'workspace/projectInitializationComplete';
    export const messageDirection: MessageDirection = MessageDirection.serverToClient;
    export const type = new NotificationType(method);
}

