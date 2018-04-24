/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StatusBarItem } from '../../../src/vscodeAdapter';
import { OmnisharpOnBeforeServerInstall, OmnisharpOnBeforeServerStart, OmnisharpServerOnServerError, OmnisharpServerOnStart, OmnisharpServerOnStop, DownloadStart, InstallationStart, DownloadProgress } from '../../../src/omnisharp/loggingEvents';
import { expect, should } from 'chai';
import { OmnisharpStatusBarObserver } from '../../../src/observers/OmnisharpStatusBarObserver';

suite('OmnisharpStatusBarObserver', () => {
    suiteSetup(() => should());
    let showCalled: boolean;
    let hideCalled: boolean;

    setup(() => {
        statusBarItem.text = undefined;
        statusBarItem.color = undefined;
        statusBarItem.command = undefined;
        statusBarItem.tooltip = undefined;
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
        expect(statusBarItem.text).to.equal(`$(flame)`);
        expect(statusBarItem.command).to.equal('o.showOutput');
        expect(statusBarItem.tooltip).to.equal('Error starting OmniSharp');
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
        expect(statusBarItem.text).to.be.equal('$(flame)');
        expect(statusBarItem.command).to.equal('o.showOutput');
        expect(statusBarItem.tooltip).to.equal('Starting OmniSharp server');
    });

    test('OnServerStart: Status bar is shown with the flame and "Running" text', () => {
        let event = new OmnisharpServerOnStart();
        observer.post(event);
        expect(showCalled).to.be.true;
        expect(statusBarItem.text).to.be.equal('$(flame)');
        expect(statusBarItem.command).to.equal('o.showOutput');
        expect(statusBarItem.tooltip).to.be.equal('OmniSharp server is running');
    });

    test('OnServerStop: Status bar is hidden and the attributes are set to undefined', () => {
        let event = new OmnisharpServerOnStop();
        observer.post(event);
        expect(hideCalled).to.be.true;
        expect(statusBarItem.text).to.be.undefined;
        expect(statusBarItem.command).to.be.undefined;
        expect(statusBarItem.color).to.be.undefined;
    });

    test('DownloadStart: Text and tooltip are set ', () => {
        let event = new DownloadStart("somePackage");
        observer.post(event);
        expect(statusBarItem.text).to.contain("Downloading packages");
        expect(statusBarItem.tooltip).to.contain(event.packageDescription);
    });

    test('InstallationProgress: Text and tooltip are set', () => {
        let event = new InstallationStart("somePackage");
        observer.post(event);
        expect(statusBarItem.text).to.contain("Installing packages");
        expect(statusBarItem.tooltip).to.contain(event.packageDescription);
    });

    test('DownloadProgress: Tooltip contains package description and download percentage', () => {
        let event = new DownloadProgress(50, "somePackage");
        observer.post(event);
        expect(statusBarItem.tooltip).to.contain(event.packageDescription);
        expect(statusBarItem.tooltip).to.contain(event.downloadPercentage);
    });
});