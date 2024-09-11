/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getNullChannel } from '../../../fakes';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { OmnisharpLoggerObserver } from '../../../../src/omnisharp/observers/omnisharpLoggerObserver';
import {
    OmnisharpServerMsBuildProjectDiagnostics,
    OmnisharpServerOnStdErr,
    OmnisharpServerMessage,
    OmnisharpServerOnServerError,
    OmnisharpInitialisation,
    OmnisharpLaunch,
    OmnisharpServerOnError,
    OmnisharpFailure,
    OmnisharpEventPacketReceived,
} from '../../../../src/omnisharp/omnisharpLoggingEvents';
import { OutputChannel } from 'vscode';
import { PlatformInformation } from '../../../../src/shared/platform';
import { EventWithMessage } from '../../../../src/shared/loggingEvents';

describe('OmnisharpLoggerObserver', () => {
    let logOutput = '';
    const channel = <OutputChannel>{
        ...getNullChannel(),
        append: (text: string) => {
            logOutput += text;
        },
    };
    const observer = new OmnisharpLoggerObserver(channel, <PlatformInformation>{
        architecture: 'x128',
        platform: 'TestOS',
    });

    beforeEach(() => {
        logOutput = '';
    });

    describe('OmnisharpServerMsBuildProjectDiagnostics', () => {
        test('Logged message is empty if there are no warnings and erros', () => {
            const event = new OmnisharpServerMsBuildProjectDiagnostics({
                FileName: 'someFile',
                Warnings: [],
                Errors: [],
            });
            observer.post(event);
            expect(logOutput).toBe('');
        });

        test(`Logged message contains the Filename if there is atleast one error or warning`, () => {
            const event = new OmnisharpServerMsBuildProjectDiagnostics({
                FileName: 'someFile',
                Warnings: [
                    {
                        FileName: 'warningFile',
                        LogLevel: '',
                        Text: '',
                        StartLine: 0,
                        EndLine: 0,
                        StartColumn: 0,
                        EndColumn: 0,
                    },
                ],
                Errors: [],
            });
            observer.post(event);
            expect(logOutput).toContain(event.diagnostics.FileName);
        });

        [
            new OmnisharpServerMsBuildProjectDiagnostics({
                FileName: 'someFile',
                Warnings: [
                    {
                        FileName: 'warningFile',
                        LogLevel: '',
                        Text: 'someWarningText',
                        StartLine: 1,
                        EndLine: 2,
                        StartColumn: 3,
                        EndColumn: 4,
                    },
                ],
                Errors: [
                    {
                        FileName: 'errorFile',
                        LogLevel: '',
                        Text: 'someErrorText',
                        StartLine: 5,
                        EndLine: 6,
                        StartColumn: 7,
                        EndColumn: 8,
                    },
                ],
            }),
        ].forEach((event: OmnisharpServerMsBuildProjectDiagnostics) => {
            test(`Logged message contains the Filename, StartColumn, StartLine and Text for the diagnostic warnings`, () => {
                observer.post(event);
                event.diagnostics.Warnings.forEach((element) => {
                    expect(logOutput).toContain(element.FileName);
                    expect(logOutput).toContain(element.StartLine.toString());
                    expect(logOutput).toContain(element.StartColumn.toString());
                    expect(logOutput).toContain(element.Text);
                });
            });

            test(`Logged message contains the Filename, StartColumn, StartLine and Text for the diagnostics errors`, () => {
                observer.post(event);
                event.diagnostics.Errors.forEach((element) => {
                    expect(logOutput).toContain(element.FileName);
                    expect(logOutput).toContain(element.StartLine.toString());
                    expect(logOutput).toContain(element.StartColumn.toString());
                    expect(logOutput).toContain(element.Text);
                });
            });
        });
    });

    [new OmnisharpServerOnStdErr('on std error message'), new OmnisharpServerMessage('server message')].forEach(
        (event: EventWithMessage) => {
            test(`${event.constructor.name}: Message is logged`, () => {
                observer.post(event);
                expect(logOutput).toContain(event.message);
            });
        }
    );

    test(`OmnisharpServerOnServerError: Message is logged`, () => {
        const event = new OmnisharpServerOnServerError('on server error message');
        observer.post(event);
        expect(logOutput).toContain(event.err);
    });

    [new OmnisharpInitialisation([], new Date(5), 'somePath')].forEach((event: OmnisharpInitialisation) => {
        test(`${event.constructor.name}: TimeStamp and SolutionPath are logged`, () => {
            observer.post(event);
            expect(logOutput).toContain(event.timeStamp.toLocaleString());
            expect(logOutput).toContain(event.solutionPath);
        });
    });

    test('OmnisharpFailure: Failure message is logged', () => {
        const event = new OmnisharpFailure('failureMessage', new Error('errorMessage'));
        observer.post(event);
        expect(logOutput).toContain(event.message);
    });

    describe('OmnisharpEventPacketReceived', () => {
        [
            new OmnisharpEventPacketReceived('TRACE', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('DEBUG', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('INFORMATION', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('WARNING', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('ERROR', 'foo', 'someMessage'),
            new OmnisharpEventPacketReceived('CRITICAL', 'foo', 'someMessage'),
        ].forEach((event: OmnisharpEventPacketReceived) => {
            test(`${event.logLevel} messages are logged with name and the message`, () => {
                observer.post(event);
                expect(logOutput).toContain(event.name);
                expect(logOutput).toContain(event.message);
            });
        });

        test('Throws error on unknown log level', () => {
            const event = new OmnisharpEventPacketReceived('random log level', 'foo', 'someMessage');
            const fn = function () {
                observer.post(event);
            };
            expect(fn).toThrow(Error);
        });

        test(`Information messages with name OmniSharp.Middleware.LoggingMiddleware and follow pattern /^/[/w]+: 200 d+ms/ are not logged`, () => {
            const event = new OmnisharpEventPacketReceived(
                'INFORMATION',
                'OmniSharp.Middleware.LoggingMiddleware',
                '/codecheck: 200 339ms'
            );
            observer.post(event);
            expect(logOutput).toBe('');
        });
    });

    describe('OmnisharpLaunch', () => {
        [
            {
                event: new OmnisharpLaunch('5.8.0', undefined, true, 'someCommand', 4),
                expected: 'OmniSharp server started with Mono 5.8.0.',
            },
            {
                event: new OmnisharpLaunch('6.0.100', undefined, false, 'someCommand', 4),
                expected: 'OmniSharp server started with .NET 6.0.100.',
            },
            {
                event: new OmnisharpLaunch(undefined, undefined, true, 'someCommand', 4),
                expected: 'OmniSharp server started.',
            },
            {
                event: new OmnisharpLaunch(undefined, undefined, false, 'someCommand', 4),
                expected: 'OmniSharp server started.',
            },
            {
                event: new OmnisharpLaunch('5.8.0', 'path to mono', true, 'someCommand', 4),
                expected: 'OmniSharp server started with Mono 5.8.0 (path to mono).',
            },
            {
                event: new OmnisharpLaunch('6.0.100', 'path to dotnet', false, 'someCommand', 4),
                expected: 'OmniSharp server started with .NET 6.0.100 (path to dotnet).',
            },
            {
                event: new OmnisharpLaunch(undefined, 'path to mono', true, 'someCommand', 4),
                expected: 'OmniSharp server started.',
            },
            {
                event: new OmnisharpLaunch(undefined, 'path to dotnet', false, 'someCommand', 4),
                expected: 'OmniSharp server started.',
            },
        ].forEach((data: { event: OmnisharpLaunch; expected: string }) => {
            const event = data.event;

            test(`Command and Pid are displayed`, () => {
                observer.post(event);
                expect(logOutput).toContain(event.command);
                expect(logOutput).toContain(event.pid.toString());
            });

            test(`Message is displayed depending on hostVersion and hostPath value`, () => {
                observer.post(event);
                expect(logOutput).toContain(data.expected);
            });
        });
    });

    describe('OmnisharpServerOnError', () => {
        test(`Doesnot throw error if FileName is null`, () => {
            const event = new OmnisharpServerOnError({ Text: 'someText', FileName: null!, Line: 1, Column: 2 });
            const fn = function () {
                observer.post(event);
            };
            expect(fn).not.toThrow(Error);
        });

        [new OmnisharpServerOnError({ Text: 'someText', FileName: 'someFile', Line: 1, Column: 2 })].forEach(
            (event: OmnisharpServerOnError) => {
                test(`Contains the error message text`, () => {
                    observer.post(event);
                    expect(logOutput).toContain(event.errorMessage.Text);
                });

                test(`Contains the error message FileName, Line and column if FileName is not null`, () => {
                    observer.post(event);
                    if (event.errorMessage.FileName) {
                        expect(logOutput).toContain(event.errorMessage.FileName);
                        expect(logOutput).toContain(event.errorMessage.Line.toString());
                        expect(logOutput).toContain(event.errorMessage.Column.toString());
                    }
                });
            }
        );
    });
});
