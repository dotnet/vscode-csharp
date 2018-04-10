/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WarningMessageObserver } from '../../../src/observers/WarningMessageObserver';
import { assert, use as chaiUse, expect, should } from 'chai';
import { getFakeVsCode, getMSBuildDiagnosticsMessage, getOmnisharpMSBuildProjectDiagnosticsEvent, getOmnisharpServerOnErrorEvent } from './Fakes';
import { BaseEvent } from '../../../src/omnisharp/loggingEvents';
import { vscode } from '../../../src/vscodeAdapter';
import { TestScheduler } from 'rxjs/testing/TestScheduler';
import { Observable } from 'rxjs/Observable';
import "rxjs/add/operator/map";
import "rxjs/add/operator/debounceTime";
import 'rxjs/add/operator/timeout';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/observable/timer';

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
    let observer: WarningMessageObserver;
    let vscode: vscode = getFakeVsCode();

    vscode.window.showWarningMessage = async <T>(message: string, ...items: T[]) => {
        warningMessages.push(message);

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
        scheduler = new TestScheduler(assert.deepEqual);
        scheduler.maxFrames = 9000;
        observer = new WarningMessageObserver(vscode, scheduler);
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
        observer.post(event);
        expect(invokedCommand).to.be.undefined;
    });

    [
        getOmnisharpMSBuildProjectDiagnosticsEvent("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
            [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]),
        getOmnisharpServerOnErrorEvent("someText", "someFile", 1, 2)
    ].forEach((event: BaseEvent) => {
        suite(`${event.constructor.name}`, () => {

            test(`When the event is fired then a warning message is displayed`, () => {
                let marble = `${timeToMarble(1500)}a--|`;
                let eventList = scheduler.createHotObservable(marble, { a: event });
                scheduler.expectObservable(eventList.map(e => observer.post(e)));
                scheduler.flush();
                expect(warningMessages.length).to.be.equal(1);
                expect(warningMessages[0]).to.be.equal("Some projects have trouble loading. Please review the output for more details.");
            });

            test(`When events are fired rapidly, then they are debounced by 1500 ms`, () => {
                let marble = `${timeToMarble(1000)}a${timeToMarble(500)}b${timeToMarble(500)}c--|`;

                let eventB =  getOmnisharpMSBuildProjectDiagnosticsEvent("BFile",
                [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]);

                let eventC =  getOmnisharpMSBuildProjectDiagnosticsEvent("CFile",
                [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]);

                let eventList = scheduler.createHotObservable(marble, { a: event, b: eventB, c: eventC });
                scheduler.expectObservable(eventList.map(e => observer.post(e)));
                scheduler.flush();
                expect(warningMessages.length).to.be.equal(1);
                expect(warningMessages[0]).to.be.equal("Some projects have trouble loading. Please review the output for more details.");
            });

            test(`When events are 1500 ms apart, then they are not debounced`, () => {
                let marble = `${timeToMarble(1000)}a${timeToMarble(500)}b${timeToMarble(1500)}c--|`;

                let eventB =  getOmnisharpMSBuildProjectDiagnosticsEvent("BFile",
                [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]);

                let eventC =  getOmnisharpMSBuildProjectDiagnosticsEvent("CFile",
                [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]);

                let eventList = scheduler.createHotObservable(marble, { a: event, b: eventB, c: eventC });
                scheduler.expectObservable(eventList.map(e => observer.post(e)));
                scheduler.flush();
                expect(warningMessages.length).to.be.equal(2);
                expect(warningMessages[0]).to.be.equal("Some projects have trouble loading. Please review the output for more details.");
            });

            test(`Given a warning message, when the user clicks ok the command is executed`, async () => {
                let marble = `${timeToMarble(1500)}a--|`;
                let eventList = scheduler.createHotObservable(marble, { a: event });
                scheduler.expectObservable(eventList.map(e => observer.post(e)));
                scheduler.flush();
                doClickOk();
                await commandDone;
                expect(invokedCommand).to.be.equal("o.showOutput");
            });

            test(`Given a warning message, when the user clicks cancel the command is not executed`, async () => {
                let marble = `${timeToMarble(1500)}a--|`;
                let eventList = scheduler.createHotObservable(marble, { a: event });
                scheduler.expectObservable(eventList.map(e => observer.post(e)));
                scheduler.flush();
                doClickCancel();
                await expect(Observable.fromPromise(commandDone).timeout(1).toPromise()).to.be.rejected;
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