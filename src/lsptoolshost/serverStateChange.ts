/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum ServerState {
    Stopped = 0,
    Started = 1,
    ProjectInitializationStarted = 2,
    ProjectInitializationComplete = 3,
}

export interface ServerStateChangeEvent {
    state: ServerState;
    workspaceLabel: string;
}
