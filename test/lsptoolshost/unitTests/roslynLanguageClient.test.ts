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
        async createMessageTransports(): Promise<unknown> {
            return { reader: {}, writer: {} };
        }
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

/** A stand-in for a server process that has not exited yet. */
function runningProcess(): ChildProcess {
    return new EventEmitter() as unknown as ChildProcess;
}

function createClient() {
    const sendTelemetryEvent = jest.fn();
    const showCrashNotificationCore = jest.fn();
    const client = Object.create(RoslynLanguageClient.prototype) as any;

    client._hasShownConnectionClose = false;
    client._telemetryReporter = { sendTelemetryEvent };
    client.showCrashNotificationCore = showCrashNotificationCore;

    return { client, sendTelemetryEvent, showCrashNotificationCore };
}

/** Launches a server process the way the base client does, so the exit listener gets attached. */
async function launchServer(client: any, serverProcess: ChildProcess): Promise<void> {
    client.serverProcess = serverProcess;
    await client.createMessageTransports('utf8');
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
        const serverProcess = runningProcess();
        const { client, sendTelemetryEvent, showCrashNotificationCore } = createClient();
        await launchServer(client, serverProcess);

        serverProcess.emit('exit', null, 'SIGKILL');
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
        const serverProcess = runningProcess();
        const { client, sendTelemetryEvent, showCrashNotificationCore } = createClient();
        await launchServer(client, serverProcess);

        serverProcess.emit('exit', null, 'SIGABRT');
        client.showCrashNotification();
        await flushPendingNotifications();

        expect(sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.ServerCrash, {
            signal: 'SIGABRT',
            externallyTerminated: 'false',
        });
        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });

    test('reports a crash when the process exited with a code rather than a signal', async () => {
        const serverProcess = runningProcess();
        const { client, sendTelemetryEvent, showCrashNotificationCore } = createClient();
        await launchServer(client, serverProcess);

        serverProcess.emit('exit', 1, null);
        client.showCrashNotification();
        await flushPendingNotifications();

        expect(sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.ServerCrash, {
            signal: '',
            externallyTerminated: 'false',
        });
        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });

    test('reports a crash when the server never launched', async () => {
        const { client, showCrashNotificationCore } = createClient();

        client.showCrashNotification();
        await flushPendingNotifications();

        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });

    test('keeps listening after the base client drops its reference to the process', async () => {
        const serverProcess = runningProcess();
        const { client, showCrashNotificationCore } = createClient();
        await launchServer(client, serverProcess);

        // The close handler runs before the process is reaped and leaves nothing to read the signal
        // from, but clearing that reference does not unregister our listener.
        await client.handleConnectionClosed();
        expect(client.serverProcess).toBeUndefined();

        client.showCrashNotification();
        await flushPendingNotifications();
        expect(showCrashNotificationCore).not.toHaveBeenCalled();

        serverProcess.emit('exit', null, 'SIGKILL');
        await flushPendingNotifications();

        expect(showCrashNotificationCore).toHaveBeenCalledWith(true);
    });

    test('describes the current process rather than a previous session', async () => {
        const killedProcess = runningProcess();
        const { client, showCrashNotificationCore } = createClient();
        await launchServer(client, killedProcess);
        killedProcess.emit('exit', null, 'SIGKILL');

        // Restarting replaces the captured exit, so the earlier kill is not reported again.
        const restartedProcess = runningProcess();
        await launchServer(client, restartedProcess);

        restartedProcess.emit('exit', 1, null);
        client.showCrashNotification();
        await flushPendingNotifications();

        expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
    });

    test('falls back to the generic crash message when the process outlives the connection', async () => {
        jest.useFakeTimers();
        try {
            const { client, showCrashNotificationCore } = createClient();
            await launchServer(client, runningProcess());

            client.showCrashNotification();
            await jest.advanceTimersByTimeAsync(1000);

            expect(showCrashNotificationCore).toHaveBeenCalledWith(false);
        } finally {
            jest.useRealTimers();
        }
    });
});
