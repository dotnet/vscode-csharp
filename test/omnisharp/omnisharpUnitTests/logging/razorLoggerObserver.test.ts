/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { getNullChannel } from '../../../fakes';
import { RazorLoggerObserver } from '../../../../src/omnisharp/observers/razorLoggerObserver';
import {
    RazorPluginPathSpecified,
    RazorPluginPathDoesNotExist,
    RazorDevModeActive,
} from '../../../../src/omnisharp/omnisharpLoggingEvents';

describe('RazorLoggerObserver', () => {
    let logOutput = '';
    const observer = new RazorLoggerObserver({
        ...getNullChannel(),
        append: (text: string) => {
            logOutput += text;
        },
    });

    beforeEach(() => {
        logOutput = '';
    });

    test(`RazorPluginPathSpecified: Path is logged`, () => {
        const event = new RazorPluginPathSpecified('somePath');
        observer.post(event);
        expect(logOutput).toContain(event.path);
    });

    test(`RazorPluginPathDoesNotExist: Path is logged`, () => {
        const event = new RazorPluginPathDoesNotExist('somePath');
        observer.post(event);
        expect(logOutput).toContain(event.path);
    });

    test(`RazorDevModeActive: Logs dev mode active`, () => {
        const event = new RazorDevModeActive();
        observer.post(event);
        expect(logOutput).toContain('Razor dev mode active');
    });
});
