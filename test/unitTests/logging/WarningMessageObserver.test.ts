/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { WarningMessageObserver } from '../../../src/observers/WarningMessageObserver';
import { assert, use as chaiUse, expect, should } from 'chai';
import { getFakeVsCode, getMSBuildDiagnosticsMessage, getOmnisharpMSBuildProjectDiagnosticsEvent, getOmnisharpServerOnErrorEvent } from '../testAssets/Fakes';
import { vscode } from '../../../src/vscodeAdapter';
import { TestScheduler } from 'rxjs/testing';
import { from as observableFrom, Subject } from 'rxjs';
import { timeout, map } from 'rxjs/operators';

chaiUse(require('chai-as-promised'));
chaiUse(require('chai-string'));

suite('WarningMessageObserver', () => {
    suiteSetup(() => should());

    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone = new Promise<void>(resolve => {
        signalCommandDone = () => { resolve(); };
    });

    let warningMessages: string[];
    let invokedCommand: string;
    let scheduler: TestScheduler;
    let assertionObservable: Subject<string>;
    let observer: WarningMessageObserver;
    let vscode: vscode = getFakeVsCode();

    vscode.window.showWarningMessage = async <T>(message: string, ...items: T[]) => {
        warningMessages.push(message);
        assertionObservable.next(`[${warningMessages.length}] ${message}`);
        return new Promise<T>(resolve => {
            doClickCancel = () => {
                resolve(undefined);
            };

            doClickOk = () => {
                resolve(items[0]);
            };
        });
    };

    vscode.commands.executeCommand = <T>(command: string, ...rest: any[]) => {
        invokedCommand = command;
        signalCommandDone();
        return <T>undefined;
    };

    setup(() => {
        assertionObservable = new Subject<string>();
        scheduler = new TestScheduler(assert.deepEqual);
        scheduler.maxFrames = 9000;
        observer = new WarningMessageObserver(vscode, () => false, scheduler);
        warningMessages = [];
        invokedCommand = undefined;
        commandDone = new Promise<void>(resolve => {
            signalCommandDone = () => { resolve(); };
        });
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors array is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            []);
        let marble = `a`;
        let marble_event_map = { a: event };
        let eventList = scheduler.createHotObservable(marble, marble_event_map);
        eventList.subscribe(e => observer.post(e));
        scheduler.flush();
        expect(warningMessages).to.be.empty;
        expect(invokedCommand).to.be.undefined;
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No event is posted if warning is disabled', () => {
        let newObserver = new WarningMessageObserver(vscode, () => true, scheduler);
        let event = getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)]);
        let marble = `a`;
        let marble_event_map = { a: event };
        let eventList = scheduler.createHotObservable(marble, marble_event_map);
        eventList.subscribe(e => newObserver.post(e));
        scheduler.flush();
        expect(warningMessages).to.be.empty;
        expect(invokedCommand).to.be.undefined;
    });

    [
        {
            eventA: getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
                [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]),

            eventB: getOmnisharpMSBuildProjectDiagnosticsEvent("BFile",
                [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]),

            eventC: getOmnisharpMSBuildProjectDiagnosticsEvent("CFile",
                [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]),
            assertion1: '[1] Some projects have trouble loading. Please review the output for more details.',
            assertion2: '[2] Some projects have trouble loading. Please review the output for more details.',
            expected: "Some projects have trouble loading. Please review the output for more details.",
            command: "o.showOutput"
        },
        {
            eventA: getOmnisharpServerOnErrorEvent("someText1", "someFile1", 1, 2),
            eventB: getOmnisharpServerOnErrorEvent("someText2", "someFile2", 1, 2),
            eventC: getOmnisharpServerOnErrorEvent("someText3", "someFile3", 1, 2),
            assertion1: '[1] Some projects have trouble loading. Please review the output for more details.',
            assertion2: '[2] Some projects have trouble loading. Please review the output for more details.',
            expected: "Some projects have trouble loading. Please review the output for more details.",
            command: "o.showOutput"
        }
    ].forEach(elem => {
        suite(`${elem.eventA.constructor.name}`, () => {
            test(`When the event is fired then a warning message is displayed`, () => {
                let marble = `${timeToMarble(1500)}a`;
                let marble_event_map = { a: elem.eventA };
                let eventList = scheduler.createHotObservable(marble, marble_event_map);
                eventList.subscribe(e => observer.post(e));
                scheduler.expectObservable(assertionObservable).toBe(`${timeToMarble(3000)}a`, { a: elem.assertion1 });
                scheduler.flush();
                expect(warningMessages.length).to.be.equal(1);
                expect(warningMessages[0]).to.be.equal(elem.expected);
            });

            test(`When events are fired rapidly, then they are debounced by 1500 ms`, () => {
                let marble = `${timeToMarble(1000)}a${timeToMarble(500)}b${timeToMarble(500)}c`;
                let marble_event_map = { a: elem.eventA, b: elem.eventB, c: elem.eventC };
                let eventList = scheduler.createHotObservable(marble, marble_event_map);
                eventList.subscribe(e => observer.post(e));
                scheduler.expectObservable(assertionObservable).toBe(`${timeToMarble(3520)}a`, { a: elem.assertion1 });
                scheduler.flush();

                expect(warningMessages.length).to.be.equal(1);
                expect(warningMessages[0]).to.be.equal(elem.expected);
            });

            test(`When events are 1500 ms apart, then they are not debounced`, () => {
                let marble = `${timeToMarble(1000)}a${timeToMarble(490)}b${timeToMarble(1500)}c`;
                let marble_event_map = { a: elem.eventA, b: elem.eventB, c: elem.eventC };
                let eventList = scheduler.createHotObservable(marble, marble_event_map);
                eventList.subscribe(e => observer.post(e));
                scheduler.expectObservable(assertionObservable).toBe(`${timeToMarble(3000)}a${timeToMarble(1500)}b`,
                    {
                        a: elem.assertion1,
                        b: elem.assertion2
                    });
                scheduler.flush();
                expect(warningMessages.length).to.be.equal(2);
                expect(warningMessages[0]).to.be.equal(elem.expected);
            });

            test(`Given a warning message, when the user clicks ok the command is executed`, async () => {
                let marble = `${timeToMarble(1500)}a`;
                let eventList = scheduler.createHotObservable(marble, { a: elem.eventA });
                scheduler.expectObservable(eventList.pipe(map(e => observer.post(e))));
                scheduler.flush();
                doClickOk();
                await commandDone;
                expect(invokedCommand).to.be.equal(elem.command);
            });

            test(`Given a warning message, when the user clicks cancel the command is not executed`, async () => {
                let marble = `${timeToMarble(1500)}a--|`;
                let eventList = scheduler.createHotObservable(marble, { a: elem.eventA });
                scheduler.expectObservable(eventList.pipe(map(e => observer.post(e))));
                scheduler.flush();
                doClickCancel();
                await expect(observableFrom(commandDone).pipe(timeout(1)).toPromise()).to.be.rejected;
                expect(invokedCommand).to.be.undefined;
            });
        });
    });
});

function timeToMarble(timeinMilliseconds: number): string {
    let marble = "";
    for (let i = 0; i < (timeinMilliseconds / 10); i++) {
        marble += "-";
    }
    return marble;
}