/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { EventWithMessage, DebuggerWarning, DotnetTestDebugStart, BaseEvent, DotnetTestRunStart, DebugStart, DotnetTestMessage, DebugComplete } from '../../../src/omnisharp/loggingEvents';
import DotnetTestLoggerObserver from '../../../src/observers/DotnetTestLoggerObserver';

suite("DotnetTestLoggerObserver", () => {
    let appendedMessage: string;
    let observer = new DotnetTestLoggerObserver({
        ...getNullChannel(),
        append: (text: string) => { appendedMessage += text; },
    });

    setup(() => {
        appendedMessage = "";
    });

    [
        new DebuggerWarning("some warning"),
        new DotnetTestMessage("some message")
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Message is logged`, () => {
            observer.post(event);
            expect(appendedMessage).to.contain(event.message);
        });
    });

    [
        new DotnetTestDebugStart("foo"),
        new DotnetTestRunStart("foo")
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Test method is logged`, () => {
            expect(appendedMessage).to.be.empty;
            observer.post(event);
            expect(appendedMessage).to.contain("foo");
        });
    });

    test(`${DebugStart.constructor.name}: Target process id is logged`, () => {
        let event = new DebugStart(111);
        observer.post(event);
        expect(appendedMessage).to.contain(event.targetProcessId);
    });

    test(`${DebugComplete.constructor.name}: Target process id is logged`, () => {
        let event = new DebugComplete();
        observer.post(event);
        expect(appendedMessage).to.not.be.empty;
    });
});
