/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, jest, test } from '@jest/globals';

jest.mock('vscode-languageclient/node', () => ({
    LanguageClient: class {},
    State: { Running: 2 },
}));
jest.mock('vscode-languageclient', () => ({}));

import { RoslynLanguageClient } from '../../../src/lsptoolshost/server/roslynLanguageClient';
import { TelemetryEventNames } from '../../../src/shared/telemetryEventNames';

describe('RoslynLanguageClient', () => {
    test('shows one crash notification and emits one telemetry event per crash', () => {
        const sendTelemetryEvent = jest.fn();
        const showCrashNotificationCore = jest.fn();
        const client = Object.create(RoslynLanguageClient.prototype) as any;

        client._hasShownConnectionClose = false;
        client._telemetryReporter = { sendTelemetryEvent };
        client.showCrashNotificationCore = showCrashNotificationCore;

        client.showCrashNotification();
        client.showCrashNotification();

        expect(sendTelemetryEvent).toHaveBeenCalledTimes(1);
        expect(sendTelemetryEvent).toHaveBeenCalledWith(TelemetryEventNames.ClientServerCrash);
        expect(showCrashNotificationCore).toHaveBeenCalledTimes(1);
    });
});
