/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ServerStateChange } from './serverStateChange';
import { IDisposable } from '../disposable';

/**
 * Defines events that are fired by the language server.
 * These events can be consumed to wait for the server to reach a certain state.
 */
export interface LanguageServerEvents {
    readonly onServerStateChange: vscode.Event<ServerStateChange>;
}

/**
 * Implementation that fires events when the language server reaches a certain state.
 * This is intentionally separate from the language server itself, so consumers can
 * register for events without having to know about the specific current state of the language server.
 */
export class RoslynLanguageServerEvents implements LanguageServerEvents, IDisposable {
    public readonly onServerStateChangeEmitter = new vscode.EventEmitter<ServerStateChange>();

    public get onServerStateChange(): vscode.Event<ServerStateChange> {
        return this.onServerStateChangeEmitter.event;
    }

    dispose(): void {
        this.onServerStateChangeEmitter.dispose();
    }
}
