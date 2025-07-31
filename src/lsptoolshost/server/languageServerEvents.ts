/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IDisposable } from '../../disposable';

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

export interface ProjectsRestoredEvent {
    success: boolean;
}

export interface ProjectReloadStartedEvent {
    projectFilePaths: string[];
}

export interface ProjectReloadCompletedEvent {
    projectFilePaths: string[];
}

/**
 * Defines events that are fired by the language server.
 * These events can be consumed to wait for the server to reach a certain state.
 */
export interface LanguageServerEvents {
    readonly onServerStateChange: vscode.Event<ServerStateChangeEvent>;
    readonly onProjectsRestored: vscode.Event<ProjectsRestoredEvent>;
    readonly onProjectReloadStarted: vscode.Event<ProjectReloadStartedEvent>;
    readonly onProjectReloadCompleted: vscode.Event<ProjectReloadCompletedEvent>;
}

/**
 * Implementation that fires events when the language server reaches a certain state.
 * This is intentionally separate from the language server itself, so consumers can
 * register for events without having to know about the specific current state of the language server.
 */
export class RoslynLanguageServerEvents implements LanguageServerEvents, IDisposable {
    public readonly onServerStateChangeEmitter = new vscode.EventEmitter<ServerStateChangeEvent>();
    public readonly onProjectsRestoredEmitter = new vscode.EventEmitter<ProjectsRestoredEvent>();
    public readonly onProjectReloadStartedEmitter = new vscode.EventEmitter<ProjectReloadStartedEvent>();
    public readonly onProjectReloadCompletedEmitter = new vscode.EventEmitter<ProjectReloadCompletedEvent>();

    public get onServerStateChange(): vscode.Event<ServerStateChangeEvent> {
        return this.onServerStateChangeEmitter.event;
    }

    public get onProjectsRestored(): vscode.Event<ProjectsRestoredEvent> {
        return this.onProjectsRestoredEmitter.event;
    }

    public get onProjectReloadStarted(): vscode.Event<ProjectReloadStartedEvent> {
        return this.onProjectReloadStartedEmitter.event;
    }

    public get onProjectReloadCompleted(): vscode.Event<ProjectReloadCompletedEvent> {
        return this.onProjectReloadCompletedEmitter.event;
    }

    dispose(): void {
        this.onServerStateChangeEmitter.dispose();
        this.onProjectsRestoredEmitter.dispose();
        this.onProjectReloadStartedEmitter.dispose();
        this.onProjectReloadCompletedEmitter.dispose();
    }
}
