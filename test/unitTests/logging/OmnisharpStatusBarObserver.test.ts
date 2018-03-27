/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentSelector, StatusBarItem, vscode } from '../../../src/vscodeAdapter';
import { OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpOnMultipleLaunchTargets, OmnisharpServerOnServerError, OmnisharpServerOnStart } from '../../../src/omnisharp/loggingEvents';
import { expect, should } from 'chai';
import { OmnisharpStatusBarObserver } from '../../../src/observers/OmnisharpStatusBarObserver';
import { getFakeVsCode } from './Fakes';

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    let output = '';
    let showCalled: boolean;
    setup(() => {
        output = '';
        showCalled = false;
    });

    let vscode: vscode = getFakeVsCode();
    vscode.window.activeTextEditor = { document: "hello" };
    vscode.languages.match = (selector: DocumentSelector, document: any) => { return 2; };

    let statusBar = <StatusBarItem>{
        show: () => { showCalled = true; }
    };

    let observer = new OmnisharpStatusBarObserver(vscode, statusBar);

    test('OnServerError: If there is no project status, default status should be shown with the error text', () => {
        let event = new OmnisharpServerOnServerError("someError");
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text).to.equal(`$(flame) Error starting OmniSharp`);
        expect(statusBar.command).to.equal('o.showOutput');
    });

    test('OnBeforeServerInstall: If there is no project status, default status should be shown with the install text', () => {
        let event = new OmnisharpOnBeforeServerInstall();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text).to.be.equal('$(flame) Installing OmniSharp...');
        expect(statusBar.command).to.equal('o.showOutput');
    });

    test('OnBeforeServerStart: If there is no project status, default status should be shown as Starting..', () => {
        let event = new OmnisharpOnBeforeServerStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text).to.be.equal('$(flame) Starting...');
        expect(statusBar.command).to.equal('o.showOutput');
    });

    test('OnMultipleLaunchTargets: If there is no project status, default status should be shown with select project', () => {
        let event = new OmnisharpOnMultipleLaunchTargets([]);
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text).to.be.equal('$(flame) Select project');
        expect(statusBar.command).to.equal('o.pickProjectAndStart');
    });

    test('OnServerStart: If there is no project status, default status should be shown as Running', () => {
        let event = new OmnisharpServerOnStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text).to.be.equal('$(flame) Running');
        expect(statusBar.command).to.equal('o.pickProjectAndStart');
    });
});