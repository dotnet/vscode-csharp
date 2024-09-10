/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { getWorkspaceInformationUpdated, getMSBuildWorkspaceInformation } from '../../../fakes';
import { StatusBarItem } from '../../../../src/vscodeAdapter';
import { ProjectStatusBarObserver } from '../../../../src/omnisharp/observers/projectStatusBarObserver';
import { OmnisharpOnMultipleLaunchTargets, OmnisharpServerOnStop } from '../../../../src/omnisharp/loggingEvents';

describe('ProjectStatusBarObserver', () => {
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
    const observer = new ProjectStatusBarObserver(statusBarItem);

    beforeEach(() => {
        showCalled = false;
        hideCalled = false;
    });

    test('OnServerStop: Status bar is hidden and the attributes are set to undefined', () => {
        const event = new OmnisharpServerOnStop();
        observer.post(event);
        expect(hideCalled).toBe(true);
        expect(statusBarItem.text).toEqual('');
        expect(statusBarItem.command).toBe(undefined);
        expect(statusBarItem.color).toBe(undefined);
    });

    test('OnMultipleLaunchTargets: Status bar is shown with the select project option and the comand to pick a project', () => {
        const event = new OmnisharpOnMultipleLaunchTargets([]);
        observer.post(event);
        expect(showCalled).toBe(true);
        expect(statusBarItem.text).toContain('Select project');
        expect(statusBarItem.command).toEqual('o.pickProjectAndStart');
    });

    describe('WorkspaceInformationUpdated', () => {
        test('Project status is hidden if there is no MSBuild Object', () => {
            const event = getWorkspaceInformationUpdated(undefined);
            observer.post(event);
            expect(hideCalled).toBe(true);
            expect(statusBarItem.text).toEqual('');
            expect(statusBarItem.command).toBe(undefined);
        });

        test('Project status is shown if there is an MSBuild object', () => {
            const event = getWorkspaceInformationUpdated(getMSBuildWorkspaceInformation('somePath', []));
            observer.post(event);
            expect(showCalled).toBe(true);
            expect(statusBarItem.text).toContain(event.info.MsBuild?.SolutionPath);
            expect(statusBarItem.command).toEqual('o.pickProjectAndStart');
        });
    });
});
