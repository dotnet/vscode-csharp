/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { getNullChannel } from '../../../fakes';
import { EventWithMessage, BaseEvent } from '../../../../src/shared/loggingEvents';
import DotNetTestLoggerObserver from '../../../../src/omnisharp/observers/dotnetTestLoggerObserver';
import * as protocol from '../../../../src/omnisharp/protocol';
import {
    DotNetTestDebugComplete,
    DotNetTestDebugInContextStart,
    DotNetTestDebugProcessStart,
    DotNetTestDebugStart,
    DotNetTestDebugWarning,
    DotNetTestMessage,
    DotNetTestRunInContextStart,
    DotNetTestRunStart,
    DotNetTestsInClassDebugStart,
    DotNetTestsInClassRunStart,
    ReportDotNetTestResults,
} from '../../../../src/omnisharp/omnisharpLoggingEvents';

describe(`${DotNetTestLoggerObserver.name}`, () => {
    let appendedMessage: string;
    const observer = new DotNetTestLoggerObserver({
        ...getNullChannel(),
        append: (text: string) => {
            appendedMessage += text;
        },
    });

    beforeEach(() => {
        appendedMessage = '';
    });

    [new DotNetTestDebugWarning('some warning'), new DotNetTestMessage('some message')].forEach(
        (event: EventWithMessage) => {
            test(`${event.constructor.name}: Message is logged`, () => {
                observer.post(event);
                expect(appendedMessage).toContain(event.message);
            });
        }
    );

    [new DotNetTestDebugStart('foo'), new DotNetTestRunStart('foo')].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Test method is logged`, () => {
            expect(appendedMessage).toBeFalsy();
            observer.post(event);
            expect(appendedMessage).toContain('foo');
        });
    });

    [new DotNetTestsInClassDebugStart('foo'), new DotNetTestsInClassRunStart('foo')].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Class name is logged`, () => {
            expect(appendedMessage).toBeFalsy();
            observer.post(event);
            expect(appendedMessage).toContain('foo');
        });
    });

    [new DotNetTestRunInContextStart('foo', 1, 2), new DotNetTestDebugInContextStart('foo', 1, 2)].forEach(
        (event: BaseEvent) => {
            test(`${event.constructor.name}: File name and line/column are logged`, () => {
                expect(appendedMessage).toBeFalsy;
                observer.post(event);
                expect(appendedMessage).toContain('foo');
                expect(appendedMessage).toContain('2');
                expect(appendedMessage).toContain('3');
            });
        }
    );

    test(`${DotNetTestDebugProcessStart.name}: Target process id is logged`, () => {
        const event = new DotNetTestDebugProcessStart(111);
        observer.post(event);
        expect(appendedMessage).toContain(event.targetProcessId.toString());
    });

    test(`${DotNetTestDebugComplete.name}: Message is logged`, () => {
        const event = new DotNetTestDebugComplete();
        observer.post(event);
        expect(appendedMessage).toBeTruthy();
    });

    describe(`${ReportDotNetTestResults.name}`, () => {
        const event = new ReportDotNetTestResults([
            getDotNetTestResults(
                'foo',
                'failed',
                'assertion failed',
                'stacktrace1',
                ['message1', 'message2'],
                ['errorMessage1']
            ),
            getDotNetTestResults('failinator', 'failed', 'error occurred', 'stacktrace2', [], []),
            getDotNetTestResults('bar', 'skipped', '', '', ['message3', 'message4'], []),
            getDotNetTestResults('passinator', 'passed', '', '', [], []),
        ]);

        test(`Displays the outcome of each test`, () => {
            observer.post(event);
            event.results!.forEach((result) => {
                expect(appendedMessage.toUpperCase()).toContain(
                    `${result.MethodName}:\n    Outcome: ${result.Outcome}`.toUpperCase()
                );
            });
        });

        test(`Displays the total outcome`, () => {
            observer.post(event);
            expect(appendedMessage).toContain(`Total tests: 4. Passed: 1. Failed: 2. Skipped: 1`);
        });

        test('Displays the error message and error stack trace if any is present', () => {
            observer.post(event);
            expect(appendedMessage).toContain(
                'foo:\n    Outcome: Failed\n    Error Message:\n    assertion failed\n    Stack Trace:\n    stacktrace1'
            );
            expect(appendedMessage).toContain(
                'failinator:\n    Outcome: Failed\n    Error Message:\n    error occurred\n    Stack Trace:\n    stacktrace2'
            );
        });

        test(`Displays the standard output messages if any`, () => {
            observer.post(event);
            event.results!.forEach((result) => {
                result.StandardOutput.forEach((message) => expect(appendedMessage).toContain(message));
            });
        });

        test(`Displays the standard error messages if any`, () => {
            observer.post(event);
            event.results!.forEach((result) => {
                result.StandardError.forEach((message) => expect(appendedMessage).toContain(message));
            });
        });

        test(`Can handle malformed results`, () => {
            observer.post(new ReportDotNetTestResults([]));
            expect(appendedMessage).toContain(
                '----- Test Execution Summary -----\n\nTotal tests: 0. Passed: 0. Failed: 0. Skipped: 0'
            );
        });
    });
});

function getDotNetTestResults(
    methodname: string,
    outcome: string,
    errorMessage: string,
    errorStackTrace: string,
    stdoutMessages: string[],
    stdErrorMessages: string[]
): protocol.V2.DotNetTestResult {
    return {
        MethodName: methodname,
        Outcome: outcome,
        ErrorMessage: errorMessage,
        ErrorStackTrace: errorStackTrace,
        StandardOutput: stdoutMessages,
        StandardError: stdErrorMessages,
    };
}
