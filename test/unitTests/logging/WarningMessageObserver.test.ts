/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rx from 'rx';

import { MessageItemWithCommand, WarningMessageObserver } from '../../../src/observers/WarningMessageObserver';
import { use as chaiUse, expect, should } from 'chai';
import { getFakeVsCode, getMSBuildDiagnosticsMessage, getOmnisharpMSBuildProjectDiagnosticsEvent, getOmnisharpServerOnErrorEvent } from './Fakes';

import { BaseEvent } from '../../../src/omnisharp/loggingEvents';
import { resolve } from 'path';
import { vscode } from '../../../src/vscodeAdapter';

chaiUse(require('chai-string'));

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    
    let warningMessage;
    let invokedCommand;
    let scheduler: rx.HistoricalScheduler;
    let observer: WarningMessageObserver;
    let vscode: vscode = getFakeVsCode();

    vscode.window.showWarningMessage =  <T>(message, ...items) => {
        warningMessage = message;
        
        return undefined;
    };


    vscode.commands.executeCommand = <T>(command, ...rest) => {
        invokedCommand = command;
        return undefined;

    setup(() => {
        scheduler = new rx.HistoricalScheduler(0, (x, y) => {
            return x > y ? 1 : -1;
        });
        observer = new WarningMessageObserver(vscode);
    });

    beforeEach(() => {
        warningMessage = undefined;
        invokedCommand = undefined;
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors array is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            []);
        observer.post(event);
        expect(invokedCommand).to.be.undefined;
    });

    [
        getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
            [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]),
            getOmnisharpServerOnErrorEvent("someText", "someFile", 1, 2)
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Debouce function`, () => {
            observer.post(event);
            scheduler.advanceBy(1000); //since the debounce time is 1500 no output should be there
            expect(invokedCommand).to.be.undefined;
        });

        test(`${event.constructor.name}: If an event is fired within 1500ms the first event is debounced`, () => {
            observer.post(event);
            scheduler.advanceBy(1000);
            expect(invokedCommand).to.be.undefined;
            observer.post(event);
            scheduler.advanceBy(500);
            expect(invokedCommand).to.be.undefined;
            scheduler.advanceBy(1000);
            expect(invokedCommand).to.be.undefined;
            //once there is a silence for 1500 ms the function will be invoked
        });

        test(`${event.constructor.name}: Show warning message and execute command are called`, () => {
            observer.post(event);
            scheduler.advanceBy(1500);
        });
    });

    teardown(() => {
        commandExecuted = undefined;
    });
});