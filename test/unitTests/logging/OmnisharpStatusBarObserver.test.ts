/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DocumentSelector, StatusBarItem, vscode } from '../../../src/vscodeAdapter';
import { OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpOnMultipleLaunchTargets, OmnisharpServerOnServerError, OmnisharpServerOnStart } from '../../../src/omnisharp/loggingEvents';
import { expect, should } from 'chai';
import { OmnisharpStatusBarObserver } from '../../../src/observers/OmnisharpStatusBarObserver';
import { getFakeVsCode, getWorkspaceInformationUpdated, getMSBuildWorkspaceInformation } from './Fakes';

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    let output = '';
    let showCalled: boolean;
    setup(() => {
        output = '';
        showCalled = false;
    });

    let vscode: vscode = getFakeVsCode();
    vscode.window.activeTextEditor = { document: undefined };
    vscode.languages.match = (selector: DocumentSelector, document: any) => { return 2; };

    let statusBarItem = <StatusBarItem>{
        show: () => { showCalled = true; }
    };

    let observer = new OmnisharpStatusBarObserver(vscode, statusBarItem);

    test('OnServerError: If there is no project status yet, status bar is shown with the error text', () => {
        let event = new OmnisharpServerOnServerError("someError");
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.equal(`$(flame) Error starting OmniSharp`);
        expect(statusBarItem.command).to.equal('o.showOutput');
    });

    test('OnBeforeServerInstall: If there is no project status yet, status bar is shown with the installation text', () => {
        let event = new OmnisharpOnBeforeServerInstall();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame) Installing OmniSharp...');
        expect(statusBarItem.command).to.equal('o.showOutput');
    });

    test('OnBeforeServerStart: If there is no project status yet, status bar is shown with the starting text', () => {
        let event = new OmnisharpOnBeforeServerStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame) Starting...');
        expect(statusBarItem.command).to.equal('o.showOutput');
    });

    test('OnMultipleLaunchTargets: If there is no project status yet, status bar is shown with the select project option and the comand to pick a project', () => {
        let event = new OmnisharpOnMultipleLaunchTargets([]);
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame) Select project');
        expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
    });

    test('OnServerStart: If there is no project status, default status should be shown as Running', () => {
        let event = new OmnisharpServerOnStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame) Running');
        expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
    });

    suite('WorkspaceInformationUpdated', () => {
        /*test('Project status is shown', () => {
            let event = getWorkspaceInformationUpdated(null);
            observer.post(event);
            expect(showCalled).to.be.true;
            expect(statusBarItem.text).to.be.equal('$(flame) ');
            expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
        });

        test('Project status is shown', () => {
            let event = getWorkspaceInformationUpdated(getMSBuildWorkspaceInformation("somePath", []));
            observer.post(event);
            expect(showCalled).to.be.true;
            expect(statusBarItem.text).to.be.equal('$(flame) '+`${event.info.MsBuild.SolutionPath}`);
            expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
        });*/
    });
});