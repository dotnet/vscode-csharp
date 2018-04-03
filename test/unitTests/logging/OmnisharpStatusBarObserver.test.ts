/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentSelector, StatusBarItem } from '../../../src/vscodeAdapter';
import { OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpOnMultipleLaunchTargets, OmnisharpServerOnServerError, OmnisharpServerOnStart, OmnisharpServerOnStop } from '../../../src/omnisharp/loggingEvents';
import { expect, should } from 'chai';
import { OmnisharpStatusBarObserver } from '../../../src/observers/OmnisharpStatusBarObserver';
import { getFakeVsCode, getWorkspaceInformationUpdated, getMSBuildWorkspaceInformation } from './Fakes';

suite('OmnisharpStatusBarObserver', () => {
    suiteSetup(() => should());
    let output = '';
    let showCalled: boolean;
    let hideCalled: boolean;

    setup(() => {
        output = '';
        showCalled = false;
        hideCalled = false;
    });

    let statusBarItem = <StatusBarItem>{
        show: () => { showCalled = true; },
        hide: () => { hideCalled = true; }
    };

    let observer = new OmnisharpStatusBarObserver( statusBarItem);

    test('OnServerError: Status bar is shown with the error text', () => {
        let event = new OmnisharpServerOnServerError("someError");
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.equal(`$(flame) Error starting OmniSharp`);
        expect(statusBarItem.command).to.equal('o.showOutput');
    });

    test('OnBeforeServerInstall: Status bar is shown with the installation text', () => {
        let event = new OmnisharpOnBeforeServerInstall();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame) Installing OmniSharp...');
        expect(statusBarItem.command).to.equal('o.showOutput');
    });

    test('OnBeforeServerStart: Status bar is shown with the starting text', () => {
        let event = new OmnisharpOnBeforeServerStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame) Starting...');
        expect(statusBarItem.command).to.equal('o.showOutput');
    });

    test('OnServerStart: Status bar is shown with the flame and "Running" text', () => {
        let event = new OmnisharpServerOnStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame) Running');
        expect(statusBarItem.command).to.equal('o.showOutput');
    });

    test('OnServerStop: Status bar is hidden and the attributes are set to undefined', () => {
        let event = new OmnisharpServerOnStop();
        observer.post(event);
        expect(hideCalled).to.be.true;
        expect(statusBarItem.text).to.be.undefined;
        expect(statusBarItem.command).to.be.undefined;
        expect(statusBarItem.color).to.be.undefined;
    });
});