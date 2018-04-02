/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, should } from 'chai';
import { getFakeVsCode, getWorkspaceInformationUpdated, getMSBuildWorkspaceInformation } from './Fakes';
import { vscode, StatusBarItem } from '../../../src/vscodeAdapter';
import { ProjectStatusBarObserver } from '../../../src/observers/ProjectStatusBarObserver';
import { OmnisharpOnMultipleLaunchTargets } from '../../../src/omnisharp/loggingEvents';

suite('ProjectStatusBarObserver', () => {
    suiteSetup(() => should());
    let output = '';
    let showCalled: boolean;
    setup(() => {
        output = '';
        showCalled = false;
    });

    let vscode: vscode = getFakeVsCode();
    vscode.window.activeTextEditor = { document: undefined };

    let statusBarItem = <StatusBarItem>{
        show: () => { showCalled = true; }
    };

    let observer = new ProjectStatusBarObserver(vscode, statusBarItem);
    
    test('OnMultipleLaunchTargets: If there is no project status yet, status bar is shown with the select project option and the comand to pick a project', () => {
        let event = new OmnisharpOnMultipleLaunchTargets([]);
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('Select project');
        expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
    });

    // What to do of this test case here ??????
    
    /*suite('WorkspaceInformationUpdated', () => {
        test('Project status is shown', () => {
            let event = getWorkspaceInformationUpdated(null);
            observer.post(event);
            expect(showCalled).to.be.true;
            expect(statusBarItem.text).to.be.equal('$(flame) ');
            expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
        });*/

        test('Project status is shown', () => {
            let event = getWorkspaceInformationUpdated(getMSBuildWorkspaceInformation("somePath", []));
            observer.post(event);
            expect(showCalled).to.be.true;
            expect(statusBarItem.text).to.be.equal(event.info.MsBuild.SolutionPath);
            expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
        });
    });
    
});