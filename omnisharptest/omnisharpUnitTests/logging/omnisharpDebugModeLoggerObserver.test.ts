/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, test, expect, beforeEach } from '@jest/globals';
import { getNullChannel } from '../../../test/unitTests/fakes';
import {
    OmnisharpServerVerboseMessage,
    EventWithMessage,
    OmnisharpRequestMessage,
    OmnisharpServerEnqueueRequest,
    OmnisharpServerDequeueRequest,
    OmnisharpServerProcessRequestStart,
    OmnisharpEventPacketReceived,
    OmnisharpServerProcessRequestComplete,
    OmnisharpServerRequestCancelled,
} from '../../../src/omnisharp/loggingEvents';
import { OmnisharpDebugModeLoggerObserver } from '../../../src/observers/omnisharpDebugModeLoggerObserver';

describe('OmnisharpDebugModeLoggerObserver', () => {
    let logOutput = '';
    const observer = new OmnisharpDebugModeLoggerObserver({
        ...getNullChannel(),
        append: (text: string) => {
            logOutput += text;
        },
    });

    beforeEach(() => {
        logOutput = '';
    });

    [new OmnisharpServerVerboseMessage('server verbose message')].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Message is logged`, () => {
            observer.post(event);
            expect(logOutput).toContain(event.message);
        });
    });

    test(`OmnisharpServerEnqueueRequest: Name and Command is logged`, () => {
        const event = new OmnisharpServerEnqueueRequest('foo', 'someCommand');
        observer.post(event);
        expect(logOutput).toContain(event.queueName);
        expect(logOutput).toContain(event.command);
    });

    test(`OmnisharpServerDequeueRequest: QueueName, QueueStatus, Command and Id is logged`, () => {
        const event = new OmnisharpServerDequeueRequest('foo', 'pending', 'someCommand', 1);
        observer.post(event);
        expect(logOutput).toContain(event.queueName);
        expect(logOutput).toContain(event.queueStatus);
        expect(logOutput).toContain(event.command);
        expect(logOutput).toContain(event.id?.toString());
    });

    test(`OmnisharpProcessRequestStart: Name and slots is logged`, () => {
        const event = new OmnisharpServerProcessRequestStart('foobar', 2);
        observer.post(event);
        expect(logOutput).toContain(event.name);
        expect(logOutput).toContain(event.availableRequestSlots.toString());
    });

    test(`OmnisharpServerRequestCancelled: Name and Id is logged`, () => {
        const event = new OmnisharpServerRequestCancelled('foobar', 23);
        observer.post(event);
        expect(logOutput).toContain(event.command);
        expect(logOutput).toContain(event.id?.toString());
    });

    test(`OmnisharpServer messages increase and decrease indent`, () => {
        observer.post(new OmnisharpServerVerboseMessage('!indented_1'));
        observer.post(new OmnisharpServerProcessRequestStart('name', 2));
        observer.post(new OmnisharpServerVerboseMessage('indented'));
        observer.post(new OmnisharpServerProcessRequestComplete());
        observer.post(new OmnisharpServerVerboseMessage('!indented_2'));

        expect(logOutput.startsWith('    !indented_1')).toBe(true);
        expect(logOutput).toContain('\n        indented');
        expect(logOutput).toContain('\n    !indented_2');
    });

    describe('OmnisharpEventPacketReceived', () => {
        test(`Information messages with name OmniSharp.Middleware.LoggingMiddleware and follow pattern /^/[/w]+: 200 d+ms/ are logged`, () => {
            const event = new OmnisharpEventPacketReceived(
                'INFORMATION',
                'OmniSharp.Middleware.LoggingMiddleware',
                '/codecheck: 200 339ms'
            );
            observer.post(event);
            expect(logOutput).toContain(event.message);
            expect(logOutput).toContain(event.name);
        });

        [
            new OmnisharpEventPacketReceived('TRACE', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('DEBUG', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('INFORMATION', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('WARNING', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('ERROR', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('CRITICAL', 'foo', 'someMessage'),
        ].forEach((event: OmnisharpEventPacketReceived) => {
            test(`${event.logLevel} messages are not logged`, () => {
                observer.post(event);
                expect(logOutput).toBeFalsy();
            });
        });
    });

    describe('OmnisharpRequestMessage', () => {
        test(`Request Command and Id is logged`, () => {
            const event = new OmnisharpRequestMessage(
                {
                    command: 'someCommand',
                    onSuccess: () => {
                        /* empty */
                    },
                    onError: () => {
                        /* empty */
                    },
                },
                1
            );
            observer.post(event);
            expect(logOutput).toContain(event.id?.toString());
            expect(logOutput).toContain(event.request.command);
        });

        test(`Request Data is logged when it is not empty`, () => {
            const event = new OmnisharpRequestMessage(
                {
                    command: 'someCommand',
                    onSuccess: () => {
                        /* empty */
                    },
                    onError: () => {
                        /* empty */
                    },
                    data: 'someData',
                },
                1
            );
            observer.post(event);
            expect(logOutput).toContain(event.request.data);
        });
    });
});
