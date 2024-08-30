/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { StatusBarItem } from '../../../src/vscodeAdapter';
import {
    OmnisharpOnBeforeServerInstall,
    OmnisharpOnBeforeServerStart,
    OmnisharpServerOnServerError,
    OmnisharpServerOnStart,
    OmnisharpServerOnStop,
    DownloadStart,
    InstallationStart,
    DownloadProgress,
    OmnisharpServerOnStdErr,
    BaseEvent,
    InstallationSuccess,
} from '../../../src/omnisharp/loggingEvents';
import { OmnisharpStatusBarObserver, StatusBarColors } from '../../../src/observers/omnisharpStatusBarObserver';

describe('OmnisharpStatusBarObserver', () => {
    let showCalled: boolean;
    let hideCalled: boolean;

    beforeEach(() => {
        statusBarItem.text = '';
        statusBarItem.color = undefined;
        statusBarItem.command = undefined;
        statusBarItem.tooltip = undefined;
        showCalled = false;
        hideCalled = false;
    });

    const statusBarItem = <StatusBarItem>{
        show: () => {
            showCalled = true;
        },
        hide: () => {
            hideCalled = true;
        },
    };

    const observer = new OmnisharpStatusBarObserver(statusBarItem);

    [new OmnisharpServerOnServerError('someError')].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Status bar is shown with the error text`, () => {
            observer.post(event);
            expect(showCalled).toBe(true);
            expect(statusBarItem.text).toEqual(`$(flame)`);
            expect(statusBarItem.command).toEqual('o.showOutput');
            expect(statusBarItem.tooltip).toEqual('Error starting OmniSharp');
            expect(statusBarItem.color).toEqual(StatusBarColors.Red);
        });
    });

    test(`${OmnisharpServerOnStdErr.name}: Status bar is shown with the error text`, () => {
        const event = new OmnisharpServerOnStdErr('std error');
        observer.post(event);
        expect(showCalled).toBe(true);
        expect(statusBarItem.color).toEqual(StatusBarColors.Red);
        expect(statusBarItem.text).toEqual(`$(flame)`);
        expect(statusBarItem.command).toEqual('o.showOutput');
        expect(statusBarItem.tooltip).toContain(event.message);
    });

    test('OnBeforeServerInstall: Status bar is shown with the installation text', () => {
        const event = new OmnisharpOnBeforeServerInstall();
        observer.post(event);
        expect(showCalled).toBe(true);
        expect(statusBarItem.text).toEqual('$(flame) Installing OmniSharp...');
        expect(statusBarItem.command).toEqual('o.showOutput');
    });

    test('OnBeforeServerStart: Status bar is shown with the starting text', () => {
        const event = new OmnisharpOnBeforeServerStart();
        observer.post(event);
        expect(showCalled).toBe(true);
        expect(statusBarItem.color).toEqual(StatusBarColors.Yellow);
        expect(statusBarItem.text).toEqual('$(flame)');
        expect(statusBarItem.command).toEqual('o.showOutput');
        expect(statusBarItem.tooltip).toEqual('Starting OmniSharp server');
    });

    test('OnServerStart: Status bar is shown with the flame and "Running" text', () => {
        const event = new OmnisharpServerOnStart();
        observer.post(event);
        expect(showCalled).toBe(true);
        expect(statusBarItem.text).toEqual('$(flame)');
        expect(statusBarItem.command).toEqual('o.showOutput');
        expect(statusBarItem.tooltip).toEqual('OmniSharp server is running');
    });

    test('OnServerStop: Status bar is hidden and the attributes are set to undefined', () => {
        const event = new OmnisharpServerOnStop();
        observer.post(event);
        expect(hideCalled).toBe(true);
        expect(statusBarItem.text).toEqual('');
        expect(statusBarItem.command).toBe(undefined);
        expect(statusBarItem.color).toBe(undefined);
    });

    test('DownloadStart: Text and tooltip are set ', () => {
        const event = new DownloadStart('somePackage');
        observer.post(event);
        expect(statusBarItem.text).toContain('Downloading packages');
        expect(statusBarItem.tooltip).toContain(event.packageDescription);
    });

    test('InstallationProgress: Text and tooltip are set', () => {
        const event = new InstallationStart('somePackage');
        observer.post(event);
        expect(statusBarItem.text).toContain('Installing packages');
        expect(statusBarItem.tooltip).toContain(event.packageDescription);
    });

    test('DownloadProgress: Tooltip contains package description and download percentage', () => {
        const event = new DownloadProgress(50, 'somePackage');
        observer.post(event);
        expect(statusBarItem.tooltip).toContain(event.packageDescription);
        expect(statusBarItem.tooltip).toContain(event.downloadPercentage.toString());
    });

    test('InstallationSuccess: Status bar is hidden and the attributes are set to undefined', () => {
        const installationEvent = new InstallationStart('somePackage');
        observer.post(installationEvent);

        const successEvent = new InstallationSuccess();
        observer.post(successEvent);

        expect(hideCalled).toBe(true);
        expect(statusBarItem.text).toEqual('');
        expect(statusBarItem.command).toBe(undefined);
        expect(statusBarItem.color).toBe(undefined);
    });
});
