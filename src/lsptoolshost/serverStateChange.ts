/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum ServerState {
    Started = 0,
    ProjectInitializationStarted = 1,
    ProjectInitializationComplete = 2,
}

export interface ServerStateChangeEvent {
    state: ServerState;
    workspaceLabel: string;
}
