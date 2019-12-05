/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, should } from 'chai';
import { StatusBarItem } from '../../../src/vscodeAdapter';
import { OmnisharpProjectDiagnosticStatus } from '../../../src/omnisharp/loggingEvents';
import { BackgroundWorkStatusBarObserver } from '../../../src/observers/BackgroundWorkStatusBarObserver';
import { DiagnosticStatus } from '../../../src/omnisharp/protocol';

suite('BackgroundWorkStatusBarObserver', () => {
    suiteSetup(() => should());

    let showCalled: boolean;
    let hideCalled: boolean;
    let statusBarItem = <StatusBarItem>{
        show: () => { showCalled = true; },
        hide: () => { hideCalled = true; }
    };
        let observer = new BackgroundWorkStatusBarObserver(statusBarItem);

    setup(() => {
        showCalled = false;
        hideCalled = false;
    });

    test('OmnisharpProjectDiagnosticStatus.Processing: Show processing message', () => {
        let event = new OmnisharpProjectDiagnosticStatus({ Status: DiagnosticStatus.Processing, ProjectFilePath: "foo.csproj", Type: "background" });
        observer.post(event);
        expect(hideCalled).to.be.false;
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.contain('Analyzing');
    });

    test('OmnisharpProjectDiagnosticStatus.Ready: Hide processing message', () => {
        let event = new OmnisharpProjectDiagnosticStatus({ Status: DiagnosticStatus.Ready, ProjectFilePath: "foo.csproj", Type: "background" });
        observer.post(event);
        expect(hideCalled).to.be.true;
        expect(showCalled).to.be.false;
        expect(statusBarItem.text).to.be.undefined;
    });
});