/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { WarningMessageObserver } from '../../../src/omnisharp/observers/warningMessageObserver';
import {
    getFakeVsCode,
    getMSBuildDiagnosticsMessage,
    getOmnisharpMSBuildProjectDiagnosticsEvent,
    getOmnisharpServerOnErrorEvent,
} from '../../../test/unitTests/fakes';
import { vscode } from '../../../src/vscodeAdapter';
import { TestScheduler } from 'rxjs/testing';
import { from as observableFrom, Subject } from 'rxjs';
import { timeout, map } from 'rxjs/operators';

describe('WarningMessageObserver', () => {
    let doClickOk: () => void;
    let doClickCancel: () => void;
    let signalCommandDone: () => void;
    let commandDone = new Promise<void>((resolve) => {
        signalCommandDone = () => {
            resolve();
        };
    });

    let warningMessages: string[];
    let invokedCommand: string | undefined;
    let scheduler: TestScheduler;
    let assertionObservable: Subject<string>;
    let observer: WarningMessageObserver;
    const vscode: vscode = getFakeVsCode();

    vscode.window.showWarningMessage = async <T>(message: string, ...items: T[]) => {
        warningMessages.push(message);
        assertionObservable.next(`[${warningMessages.length}] ${message}`);
        return new Promise<T | undefined>((resolve) => {
            doClickCancel = () => {
                resolve(undefined);
            };

            doClickOk = () => {
                resolve(items[0]);
            };
        });
    };

    vscode.commands.executeCommand = async (command: string, ..._: any[]) => {
        invokedCommand = command;
        signalCommandDone();
        return undefined;
    };

    beforeEach(() => {
        assertionObservable = new Subject<string>();
        scheduler = new TestScheduler((actual, expected) => {
            expect(actual).toStrictEqual(expected);
        });
        scheduler.maxFrames = 9000;
        observer = new WarningMessageObserver(vscode, () => false, scheduler);
        warningMessages = [];
        invokedCommand = undefined;
        commandDone = new Promise<void>((resolve) => {
            signalCommandDone = () => {
                resolve();
            };
        });
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors array is empty', () => {
        const event = getOmnisharpMSBuildProjectDiagnosticsEvent(
            'someFile',
            [getMSBuildDiagnosticsMessage('warningFile', '', '', 0, 0, 0, 0)],
            []
        );
        const marble = `a`;
        const marble_event_map = { a: event };
        const eventList = scheduler.createHotObservable(marble, marble_event_map);
        eventList.subscribe((e) => observer.post(e));
        scheduler.flush();
        expect(warningMessages).toHaveLength(0);
        expect(invokedCommand).toBe(undefined);
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No event is posted if warning is disabled', () => {
        const newObserver = new WarningMessageObserver(vscode, () => true, scheduler);
        const event = getOmnisharpMSBuildProjectDiagnosticsEvent(
            'someFile',
            [getMSBuildDiagnosticsMessage('warningFile', '', '', 0, 0, 0, 0)],
            [getMSBuildDiagnosticsMessage('warningFile', '', '', 0, 0, 0, 0)]
        );
        const marble = `a`;
        const marble_event_map = { a: event };
        const eventList = scheduler.createHotObservable(marble, marble_event_map);
        eventList.subscribe((e) => newObserver.post(e));
        scheduler.flush();
        expect(warningMessages).toHaveLength(0);
        expect(invokedCommand).toBe(undefined);
    });

    [
        {
            eventA: getOmnisharpMSBuildProjectDiagnosticsEvent(
                'someFile',
                [getMSBuildDiagnosticsMessage('warningFile', '', '', 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage('errorFile', '', '', 5, 6, 7, 8)]
            ),

            eventB: getOmnisharpMSBuildProjectDiagnosticsEvent(
                'BFile',
                [getMSBuildDiagnosticsMessage('warningFile', '', '', 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage('errorFile', '', '', 5, 6, 7, 8)]
            ),

            eventC: getOmnisharpMSBuildProjectDiagnosticsEvent(
                'CFile',
                [getMSBuildDiagnosticsMessage('warningFile', '', '', 1, 2, 3, 4)],
                [getMSBuildDiagnosticsMessage('errorFile', '', '', 5, 6, 7, 8)]
            ),
            assertion1: '[1] Some projects have trouble loading. Please review the output for more details.',
            assertion2: '[2] Some projects have trouble loading. Please review the output for more details.',
            expected: 'Some projects have trouble loading. Please review the output for more details.',
            command: 'o.showOutput',
        },
        {
            eventA: getOmnisharpServerOnErrorEvent('someText1', 'someFile1', 1, 2),
            eventB: getOmnisharpServerOnErrorEvent('someText2', 'someFile2', 1, 2),
            eventC: getOmnisharpServerOnErrorEvent('someText3', 'someFile3', 1, 2),
            assertion1: '[1] Some projects have trouble loading. Please review the output for more details.',
            assertion2: '[2] Some projects have trouble loading. Please review the output for more details.',
            expected: 'Some projects have trouble loading. Please review the output for more details.',
            command: 'o.showOutput',
        },
    ].forEach((elem) => {
        describe(`${elem.eventA.constructor.name}`, () => {
            test(`When the event is fired then a warning message is displayed`, () => {
                const marble = `${timeToMarble(1500)}a`;
                const marble_event_map = { a: elem.eventA };
                const eventList = scheduler.createHotObservable(marble, marble_event_map);
                eventList.subscribe((e) => observer.post(e));
                scheduler.expectObservable(assertionObservable).toBe(`${timeToMarble(3000)}a`, { a: elem.assertion1 });
                scheduler.flush();
                expect(warningMessages.length).toEqual(1);
                expect(warningMessages[0]).toEqual(elem.expected);
            });

            test(`When events are fired rapidly, then they are debounced by 1500 ms`, () => {
                const marble = `${timeToMarble(1000)}a${timeToMarble(500)}b${timeToMarble(500)}c`;
                const marble_event_map = { a: elem.eventA, b: elem.eventB, c: elem.eventC };
                const eventList = scheduler.createHotObservable(marble, marble_event_map);
                eventList.subscribe((e) => observer.post(e));
                scheduler.expectObservable(assertionObservable).toBe(`${timeToMarble(3520)}a`, { a: elem.assertion1 });
                scheduler.flush();

                expect(warningMessages.length).toEqual(1);
                expect(warningMessages[0]).toEqual(elem.expected);
            });

            test(`When events are 1500 ms apart, then they are not debounced`, () => {
                const marble = `${timeToMarble(1000)}a${timeToMarble(490)}b${timeToMarble(1500)}c`;
                const marble_event_map = { a: elem.eventA, b: elem.eventB, c: elem.eventC };
                const eventList = scheduler.createHotObservable(marble, marble_event_map);
                eventList.subscribe((e) => observer.post(e));
                scheduler.expectObservable(assertionObservable).toBe(`${timeToMarble(3000)}a${timeToMarble(1500)}b`, {
                    a: elem.assertion1,
                    b: elem.assertion2,
                });
                scheduler.flush();
                expect(warningMessages.length).toEqual(2);
                expect(warningMessages[0]).toEqual(elem.expected);
            });

            test(`Given a warning message, when the user clicks ok the command is executed`, async () => {
                const marble = `${timeToMarble(1500)}a`;
                const eventList = scheduler.createHotObservable(marble, { a: elem.eventA });
                scheduler.expectObservable(eventList.pipe(map((e) => observer.post(e))));
                scheduler.flush();
                doClickOk();
                await commandDone;
                expect(invokedCommand).toEqual(elem.command);
            });

            test(`Given a warning message, when the user clicks cancel the command is not executed`, async () => {
                const marble = `${timeToMarble(1500)}a--|`;
                const eventList = scheduler.createHotObservable(marble, { a: elem.eventA });
                scheduler.expectObservable(eventList.pipe(map((e) => observer.post(e))));
                scheduler.flush();
                doClickCancel();
                await expect(observableFrom(commandDone).pipe(timeout(1)).toPromise()).rejects.toThrow();
                expect(invokedCommand).toBe(undefined);
            });
        });
    });
});

function timeToMarble(timeinMilliseconds: number): string {
    let marble = '';
    for (let i = 0; i < timeinMilliseconds / 10; i++) {
        marble += '-';
    }
    return marble;
}
