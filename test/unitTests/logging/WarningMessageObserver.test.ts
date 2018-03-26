/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import * as rx from 'rx';
import { WarningMessageObserver, ShowWarningMessage, MessageItemWithCommand, ExecuteCommand } from '../../../src/observers/WarningMessageObserver';
import { resolve } from 'path';
import { getOmnisharpMSBuildProjectDiagnosticsEvent, getMSBuildDiagnosticsMessage, getOmnisharpServerOnErrorEvent } from './Fakes';
import * as vscode from '../../../src/vscodeAdapter';
import { BaseEvent } from '../../../src/omnisharp/loggingEvents';

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    let output = '';
    let scheduler: rx.HistoricalScheduler;
    let observer: WarningMessageObserver;
    let commandExecuted: () => void;

    let warningFunction: ShowWarningMessage<MessageItemWithCommand> = (message, ...items) => {
        output += "show warning message called";
        output += message;
        items.forEach(element => {
            output += element.title;
            output += element.command;
        });

        let testMessage: MessageItemWithCommand = {
            title: "myTitle",
            command: "myCommand"
        };

        return Promise.resolve(testMessage);
    };

    let executeCommand: ExecuteCommand<string> = (command, ...rest) => {
        output += "execute command called";
        output += command;
        return new Promise(resolve => {
            resolve("execute command resolved");
            commandExecuted();
        });
    };

    setup(() => {
        output = '';
        scheduler = new rx.HistoricalScheduler(0, (x, y) => {
            return x > y ? 1 : -1;
        });
        observer = new WarningMessageObserver(warningFunction, executeCommand, scheduler);
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors array is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            []);
        observer.post(event);
        expect(output).to.be.empty;
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
            expect(output).to.be.empty;
        });

        test(`${event.constructor.name}: If an event is fired within 1500ms the first event is debounced`, () => {
            observer.post(event);
            scheduler.advanceBy(1000);
            expect(output).to.be.empty;
            observer.post(event);
            scheduler.advanceBy(500);
            expect(output).to.be.empty;
            scheduler.advanceBy(1000);
            expect(output).to.not.be.empty;
            //once there is a silence for 1500 ms the function will be invoked
        });

        test(`${event.constructor.name}: Show warning message and execute command are called`, (done) => {
            commandExecuted = () => {
                expect(output).to.contain("Show Output");
                expect(output).to.contain("o.showOutput");
                expect(output).to.contain("show warning message called");
                expect(output).to.contain("execute command called");
                expect(output).to.contain("myCommand");
                done();
            };

            observer.post(event);
            scheduler.advanceBy(1500);
        });
    });

    teardown(() => {
        commandExecuted = undefined;
    });
});