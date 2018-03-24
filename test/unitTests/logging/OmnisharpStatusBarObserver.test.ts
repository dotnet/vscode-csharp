/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentSelector, StatusBarItem, vscode } from '../../../src/vscodeAdapter';
import { OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpOnMultipleLaunchTargets, OmnisharpServerOnServerError } from '../../../src/omnisharp/loggingEvents';
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

    test('OnServerError: If there is no project status, default status should be shown which includes error and flame', () => {
        let event = new OmnisharpServerOnServerError("someError");
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text.toLowerCase()).to.contain("error");
        expect(statusBar.text).to.contain("$(flame)"); //omnisharp flame
    });

    test('OnBeforeServerInstall: If there is no project status, default status should be shown which includes install and flame', () => {
        let event = new OmnisharpOnBeforeServerInstall();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text.toLowerCase()).to.contain("install");
        expect(statusBar.text).to.contain("$(flame)");
    });

    test('OnBeforeServerStart: If there is no project status, default status should be shown which includes start and flame', () => {
        let event = new OmnisharpOnBeforeServerStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text.toLowerCase()).to.contain("start");
        expect(statusBar.text).to.contain("$(flame)");
    });

    test('OnMultipleLaunchTargets: If there is no project status, default status should be shown which includes error and flame', () => {
        let event = new OmnisharpOnMultipleLaunchTargets([]);
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBar.text.toLowerCase()).to.contain("select project");
        expect(statusBar.text).to.contain("$(flame)");
    });







});