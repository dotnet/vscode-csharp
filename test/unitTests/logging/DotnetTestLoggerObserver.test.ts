/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { EventWithMessage, DotNetTestDebugWarning, DotNetTestDebugStart, BaseEvent, DotNetTestRunStart, DotNetTestDebugProcessStart, DotNetTestMessage, DotNetTestDebugComplete, ReportDotNetTestResults } from '../../../src/omnisharp/loggingEvents';
import DotNetTestLoggerObserver from '../../../src/observers/DotnetTestLoggerObserver';
import * as protocol from '../../../src/omnisharp/protocol';

const expect = chai.expect;
chai.use(require('chai-string'));

suite(`${DotNetTestLoggerObserver.name}`, () => {
    let appendedMessage: string;
    let observer = new DotNetTestLoggerObserver({
        ...getNullChannel(),
        append: (text: string) => { appendedMessage += text; },
    });

    setup(() => {
        appendedMessage = "";
    });

    [
        new DotNetTestDebugWarning("some warning"),
        new DotNetTestMessage("some message")
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Message is logged`, () => {
            observer.post(event);
            expect(appendedMessage).to.contain(event.message);
        });
    });

    [
        new DotNetTestDebugStart("foo"),
        new DotNetTestRunStart("foo")
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Test method is logged`, () => {
            expect(appendedMessage).to.be.empty;
            observer.post(event);
            expect(appendedMessage).to.contain("foo");
        });
    });

    test(`${DotNetTestDebugProcessStart.name}: Target process id is logged`, () => {
        let event = new DotNetTestDebugProcessStart(111);
        observer.post(event);
        expect(appendedMessage).to.contain(event.targetProcessId);
    });

    test(`${DotNetTestDebugComplete.name}: Message is logged`, () => {
        let event = new DotNetTestDebugComplete();
        observer.post(event);
        expect(appendedMessage).to.not.be.empty;
    });

    suite(`${ReportDotNetTestResults.name}`, () => {
        let event = new ReportDotNetTestResults(
            [
                getDotNetTestResults("foo", "failed", "assertion failed", ""),
                getDotNetTestResults("failinator", "failed", "error occured", ""),
                getDotNetTestResults("bar", "skipped", "", ""),
                getDotNetTestResults("passinator", "passed", "", ""),
            ]);

        test(`Displays the outcome of each test`, () => {
            observer.post(event);
            event.results.forEach(result => {
                expect(appendedMessage).to.containIgnoreCase(`${result.MethodName}:\n    Outcome: ${result.Outcome}`);
            });
        });

        test(`Displays the total outcome`, () => {
            observer.post(event);
            expect(appendedMessage).to.contain(`Total tests: 4. Passed: 1. Failed: 2. Skipped: 1`);
        });

        test('Displays the error message if any is present', () => {
            observer.post(event);
            expect(appendedMessage).to.contain("foo:\n    Outcome: Failed\n    Error Message: assertion failed");
            expect(appendedMessage).to.contain("failinator:\n    Outcome: Failed\n    Error Message: error occured");
        });
    });
});

function getDotNetTestResults(methodname: string, outcome: string, errorMessage: string, errorStackTrace: string): protocol.V2.DotNetTestResult {
    return {
        MethodName: methodname,
        Outcome: outcome,
        ErrorMessage: errorMessage,
        ErrorStackTrace: errorStackTrace
    };
}