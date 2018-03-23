/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { OmnisharpStatusBarObserver, GetActiveTextEditor, Match } from '../../../src/observers/OmnisharpStatusBarObserver';
import * as vscode from '../../../src/vscodeAdapter';
import { OmnisharpServerOnServerError, OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpOnMultipleLaunchTargets } from '../../../src/omnisharp/loggingEvents';

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    let output = '';
    let showCalled: boolean;
    setup(() => {
        output = ''; 
        showCalled = false;
    });

    let getActiveTextEditor: GetActiveTextEditor = () => { return { document: "hello" }; };
    let matchFunction: Match = (selector: vscode.DocumentSelector, document: any) => { return 2; };
    let statusBar = <vscode.StatusBarItem>{
        show: () => { showCalled = true;}
    };

    let observer = new OmnisharpStatusBarObserver(getActiveTextEditor, matchFunction, statusBar);

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