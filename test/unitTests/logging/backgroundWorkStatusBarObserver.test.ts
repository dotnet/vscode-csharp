/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, should } from 'chai';
import { StatusBarItem } from '../../../src/vscodeAdapter';
import { OmnisharpBackgroundDiagnosticStatus } from '../../../src/omnisharp/loggingEvents';
import { BackgroundWorkStatusBarObserver } from '../../../src/observers/backgroundWorkStatusBarObserver';
import { BackgroundDiagnosticStatus } from '../../../src/omnisharp/protocol';

suite('BackgroundWorkStatusBarObserver', () => {
    suiteSetup(() => should());

    let showCalled: boolean;
    let hideCalled: boolean;
    const statusBarItem = <StatusBarItem>{
        show: () => { showCalled = true; },
        hide: () => { hideCalled = true; }
    };
    const observer = new BackgroundWorkStatusBarObserver(statusBarItem);

    setup(() => {
        showCalled = false;
        hideCalled = false;
    });

    test('OmnisharpBackgroundDiagnosticStatus.Processing: Show processing message', () => {
        const event = new OmnisharpBackgroundDiagnosticStatus({ Status: BackgroundDiagnosticStatus.Progress, NumberFilesRemaining: 0, NumberFilesTotal: 0, NumberProjects: 0 });
        observer.post(event);
        expect(hideCalled).to.be.false;
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.contain('Analyzing');
    });

    test('OmnisharpBackgroundDiagnosticStatus.Ready: Hide processing message', () => {
        const event = new OmnisharpBackgroundDiagnosticStatus({ Status: BackgroundDiagnosticStatus.Finished, NumberFilesRemaining: 0, NumberFilesTotal: 0, NumberProjects: 0 });
        observer.post(event);
        expect(hideCalled).to.be.true;
        expect(showCalled).to.be.false;
        expect(statusBarItem.text).to.be.equal('');
    });
});
