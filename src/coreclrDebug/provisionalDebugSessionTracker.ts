/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * This tracks a debug session until C# dev kit is loaded (if present) and STOPS tracking any existing
 * debug session after C# dev kit is loaded.
 * The idea is to avoid a race condition if a debugging session starts before C# dev kit is initialized,
 * since the brokered service pipe name will be sent with a 'launch' command.
 * If the extension loads during an existing session, rather than not initializing any C# dev kit services (such as hot reload),
 * this sends a custom request to the engine with the brokered service pipe name in order to initialize it.
 */
export class ProvisionalDebugSessionTracker {
    private _session: vscode.DebugSession | undefined;

    private _onDidStartDebugSession: vscode.Disposable | undefined;
    private _onDidTerminateDebugSession: vscode.Disposable | undefined;

    private _brokeredServicePipeName: string | undefined;

    DebuggerSessionTracker() {
        this._session = undefined;
    }

    /**
     * Initializes the debug session handlers.
     */
    async initializeDebugSessionHandlers(context: vscode.ExtensionContext): Promise<void> {
        this._onDidStartDebugSession = vscode.debug.onDidStartDebugSession(this.onDidStartDebugSession.bind(this));

        this._onDidTerminateDebugSession = vscode.debug.onDidTerminateDebugSession(
            this.onDidTerminateDebugSession.bind(this)
        );

        context.subscriptions.push(this._onDidStartDebugSession);
        context.subscriptions.push(this._onDidTerminateDebugSession);
    }

    /**
     * Tracks a debug session until it is terminated.
     * @param session Debug session.
     */
    async onDidStartDebugSession(session: vscode.DebugSession): Promise<void> {
        this._session = session;
    }

    /**
     * Notifies that a debug session has been terminated.
     */
    async onDidTerminateDebugSession(): Promise<void> {
        this._session = undefined;
    }

    /**
     * If there is any active debug session, this notifies the engine that csdevkit was loaded.
     * @param csDevKitPipeName Brokered service pipe name activated by {@link CSharpDevKitExports}.
     */
    async onCsDevKitInitialized(csDevKitPipeName: string): Promise<void> {
        if (this._session != undefined) {
            // Debugging session already started, send a custom DAP request to the engine.
            await this._session.customRequest('initializeBrokeredServicePipeName', csDevKitPipeName);
        }

        this._brokeredServicePipeName = csDevKitPipeName;

        // Since C# dev kit was initialized, we no longer need to track debugging sessions.
        this.cleanup();
    }

    /**
     * Fetches the brokered service pipe name from C# dev kit, if available.
     */
    getBrokeredServicePipeName(): string | undefined {
        return this._brokeredServicePipeName;
    }

    /**
     * No longer tracks any debugging session going forward.
     */
    cleanup(): void {
        this._session = undefined;

        this._onDidStartDebugSession?.dispose();
        this._onDidTerminateDebugSession?.dispose();
    }
}

export const debuggerSessionTracker = new ProvisionalDebugSessionTracker();
