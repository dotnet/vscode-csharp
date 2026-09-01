/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';
import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('vscode-languageclient/node', () => ({
    LanguageClient: class {
        serverProcess: unknown;
        /**
         * Stands in for the base implementation, which drops its reference to the server process
         * before invoking the close handler.
         */
        async handleConnectionClosed(): Promise<void> {
            this.serverProcess = undefined;
        }
    },
    State: { Running: 2 },
}));
jest.mock('vscode-languageclient', () => ({
    MessageDirection: {
        clientToServer: 1,
        serverToClient: 2,
    },
    NotificationType: class {},
    ProtocolRequestType: class {},
    RequestType: class {},
    RequestType0: class {},
    State: { Running: 2 },
}));

import { RoslynLanguageClient } from '../../../src/lsptoolshost/server/roslynLanguageClient';
import { TelemetryEventNames } from '../../../src/shared/telemetryEventNames';

const runningState = 2;

/** A stand-in for an already reaped process, which is what we normally observe on a crash. */
function exitedProcess(exitCode: number | null, signalCode: NodeJS.Signals | null): ChildProcess {
    return { exitCode, signalCode } as ChildProcess;
}

/** A stand-in for a process that has not been reaped yet, so the signal arrives via 'exit'. */
function runningProcess(): ChildProcess {
    const serverProcess = new EventEmitter() as unknown as ChildProcess;
    (serverProcess as { exitCode: number | null }).exitCode = null;
    (serverProcess as { signalCode: NodeJS.Signals | null }).signalCode = null;
    return serverProcess;
}

function createClient(serverProcess?: ChildProcess) {
    const sendTelemetryEvent = jest.fn();
    const showCrashNotificationCore = jest.fn();
    const client = Object.create(RoslynLanguageClient.prototype) as any;

    client._hasShownConnectionClose = false;
    client._telemetryReporter = { sendTelemetryEvent };
    client.serverProcess = serverProcess;
    client.showCrashNotificationCore = showCrashNotificationCore;

    return { client, sendTelemetryEvent, showCrashNotificationCore };
}

/** Lets the fire-and-forget notification promise chain settle. */
async function flushPendingNotifications(): Promise<void> {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

describe('RoslynLanguageClient', () => {
    test('shows one crash notification and emits one telemetry event per crash', async () => {
        const { client, sendTelemetryEvent, showCrashNotificationCore } = createClient();

        // Both the error and closed handlers fire when the server goes down.
        client.showCrashNotification();
        client.showCrashNotification();
        await flushPendingNotifications();

        expect(sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(showCrashNotificationCore).toHaveBeenCalledTimes(1);
    });

    test('reports an external termination when the process was killed with SIGKILL', async () => {
        const { client, sendTelemetryEvent, showCrashNotificationCore } = createClient(exitedProcess(null, 'SIGKILL'));

        client.showCrashNotification();
        await flushPendingNotifications();

        expect(sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.ServerCrash, {
            signal: 'SIGKILL',
            externallyTerminated: 'true',
        });
        expect(showCrashNotificationCore).toHaveBeenCalledWith(true);
    });

    // The .NET runtime ends fatal errors with abort(), so SIGABRT is the server genuinely failing.
    test('reports a crash when the runtime aborted the process', async () => {
        const { client, sendTelemetryEvent, showCrashNotificationCore } = createClient(exitedProcess(null, 'SIGABRT'));

        client.showCrashNotification();
        await flushPendingNotifications();

        expect(sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.ServerCrash, {
            signal: 'SIGABRT',
            externallyTerminated: 'false',
        });
        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });

    test('reports a crash when the process exited with a code rather than a signal', async () => {
        const { client, sendTelemetryEvent, showCrashNotificationCore } = createClient(exitedProcess(1, null));

        client.showCrashNotification();
        await flushPendingNotifications();

        expect(sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.ServerCrash, {
            signal: '',
            externallyTerminated: 'false',
        });
        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });

    test('reports a crash when there is no process to inspect', async () => {
        const { client, showCrashNotificationCore } = createClient();

        client.showCrashNotification();
        await flushPendingNotifications();

        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });

    test('waits for the exit event when the process has not been reaped yet', async () => {
        const serverProcess = runningProcess();
        const { client, showCrashNotificationCore } = createClient(serverProcess);

        client.showCrashNotification();
        await flushPendingNotifications();

        // The connection closes slightly before the process is reaped, so nothing is reported yet.
        expect(showCrashNotificationCore).not.toHaveBeenCalled();

        serverProcess.emit('exit', null, 'SIGKILL');
        await flushPendingNotifications();

        expect(showCrashNotificationCore).toHaveBeenCalledWith(true);
    });

    test('captures the signal before the base client clears the process reference', async () => {
        const serverProcess = runningProcess();
        const { client, showCrashNotificationCore } = createClient(serverProcess);

        await client.handleConnectionClosed();

        // The close handler leaves nothing to read the signal from, so the capture has to have
        // happened first. Clearing that reference does not unregister our exit listener.
        expect(client.serverProcess).toBeUndefined();

        client.showCrashNotification();
        serverProcess.emit('exit', null, 'SIGKILL');
        await flushPendingNotifications();

        expect(showCrashNotificationCore).toHaveBeenCalledWith(true);
    });

    test('clears the captured exit signal when the server restarts', async () => {
        const { client, showCrashNotificationCore } = createClient();
        let onStateChange: ((e: { newState: number }) => void) | undefined;
        client.onDidChangeState = (handler: (e: { newState: number }) => void) => (onStateChange = handler);
        client.registerStateChangeHandler();

        // A previous session was killed externally and reported.
        client._serverExitSignal = Promise.resolve<NodeJS.Signals>('SIGKILL');
        client._hasShownConnectionClose = true;

        onStateChange!({ newState: runningState });

        // A later failure in the new session must not inherit the old session's exit.
        client.showCrashNotification();
        await flushPendingNotifications();

        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });
});
