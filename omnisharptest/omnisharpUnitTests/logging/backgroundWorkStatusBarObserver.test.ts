/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { StatusBarItem } from '../../../src/vscodeAdapter';
import { OmnisharpBackgroundDiagnosticStatus } from '../../../src/omnisharp/loggingEvents';
import { BackgroundWorkStatusBarObserver } from '../../../src/observers/backgroundWorkStatusBarObserver';
import { BackgroundDiagnosticStatus } from '../../../src/omnisharp/protocol';

describe('BackgroundWorkStatusBarObserver', () => {
    let showCalled: boolean;
    let hideCalled: boolean;
    const statusBarItem = <StatusBarItem>{
        show: () => {
            showCalled = true;
        },
        hide: () => {
            hideCalled = true;
        },
    };
    const observer = new BackgroundWorkStatusBarObserver(statusBarItem);

    beforeEach(() => {
        showCalled = false;
        hideCalled = false;
    });

    test('OmnisharpBackgroundDiagnosticStatus.Processing: Show processing message', () => {
        const event = new OmnisharpBackgroundDiagnosticStatus({
            Status: BackgroundDiagnosticStatus.Progress,
            NumberFilesRemaining: 0,
            NumberFilesTotal: 0,
            NumberProjects: 0,
        });
        observer.post(event);
        expect(hideCalled).toBe(false);
        expect(showCalled).toBe(true);
        expect(statusBarItem.text).toContain('Analyzing');
    });

    test('OmnisharpBackgroundDiagnosticStatus.Ready: Hide processing message', () => {
        const event = new OmnisharpBackgroundDiagnosticStatus({
            Status: BackgroundDiagnosticStatus.Finished,
            NumberFilesRemaining: 0,
            NumberFilesTotal: 0,
            NumberProjects: 0,
        });
        observer.post(event);
        expect(hideCalled).toBe(true);
        expect(showCalled).toBe(false);
        expect(statusBarItem.text).toEqual('');
    });
});
