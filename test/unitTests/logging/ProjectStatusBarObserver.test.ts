/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, should } from 'chai';
import { getWorkspaceInformationUpdated, getMSBuildWorkspaceInformation } from '../testAssets/Fakes';
import { StatusBarItem } from '../../../src/vscodeAdapter';
import { ProjectStatusBarObserver } from '../../../src/observers/ProjectStatusBarObserver';
import { OmnisharpOnMultipleLaunchTargets, OmnisharpServerOnStop } from '../../../src/omnisharp/loggingEvents';

suite('ProjectStatusBarObserver', () => {
    suiteSetup(() => should());

    let showCalled: boolean;
    let hideCalled: boolean;
    const statusBarItem = <StatusBarItem>{
        show: () => { showCalled = true; },
        hide: () => { hideCalled = true; }
    };
    const observer = new ProjectStatusBarObserver(statusBarItem);

    setup(() => {
        showCalled = false;
        hideCalled = false;
    });

    test('OnServerStop: Status bar is hidden and the attributes are set to undefined', () => {
        const event = new OmnisharpServerOnStop();
        observer.post(event);
        expect(hideCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('');
        expect(statusBarItem.command).to.be.undefined;
        expect(statusBarItem.color).to.be.undefined;
    });

    test('OnMultipleLaunchTargets: Status bar is shown with the select project option and the comand to pick a project', () => {
        const event = new OmnisharpOnMultipleLaunchTargets([]);
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.contain('Select project');
        expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
    });

    suite('WorkspaceInformationUpdated', () => {
        test('Project status is hidden if there is no MSBuild Object', () => {
            const event = getWorkspaceInformationUpdated(undefined);
            observer.post(event);
            expect(hideCalled).to.be.true;
            expect(statusBarItem.text).to.be.equal('');
            expect(statusBarItem.command).to.be.undefined;
        });

        test('Project status is shown if there is an MSBuild object', () => {
            const event = getWorkspaceInformationUpdated(getMSBuildWorkspaceInformation("somePath", []));
            observer.post(event);
            expect(showCalled).to.be.true;
            expect(statusBarItem.text).to.contain(event.info.MsBuild?.SolutionPath);
            expect(statusBarItem.command).to.equal('o.pickProjectAndStart');
        });
    });
});
