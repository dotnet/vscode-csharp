/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { OmnisharpLoggerObserver } from '../../../src/observers/OmnisharpLoggerObserver';
import { OmnisharpServerMsBuildProjectDiagnostics, EventWithMessage, OmnisharpServerOnStdErr, OmnisharpServerMessage, OmnisharpServerOnServerError, OmnisharpInitialisation, OmnisharpLaunch, OmnisharpServerOnError, OmnisharpFailure, OmnisharpEventPacketReceived } from '../../../src/omnisharp/loggingEvents';

suite("OmnisharpLoggerObserver", () => {
    suiteSetup(() => should());

    let logOutput = "";
    let observer = new OmnisharpLoggerObserver({
        ...getNullChannel(),
        append: (text: string) => { logOutput += text; },
    });

    setup(() => {
        logOutput = "";
    });

    suite('OmnisharpServerMsBuildProjectDiagnostics', () => {

        test("Logged message is empty if there are no warnings and erros", () => {
            let event = new OmnisharpServerMsBuildProjectDiagnostics({
                FileName: "someFile",
                Warnings: [],
                Errors: []
            });
            observer.post(event);
            expect(logOutput).to.be.empty;
        });

        test(`Logged message contains the Filename if there is atleast one error or warning`, () => {
            let event = new OmnisharpServerMsBuildProjectDiagnostics({
                FileName: "someFile",
                Warnings: [{ FileName: "warningFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }],
                Errors: []
            });
            observer.post(event);
            expect(logOutput).to.contain(event.diagnostics.FileName);
        });

        [
            new OmnisharpServerMsBuildProjectDiagnostics({
                FileName: "someFile",
                Warnings: [{ FileName: "warningFile", LogLevel: "", Text: "someWarningText", StartLine: 1, EndLine: 2, StartColumn: 3, EndColumn: 4 }],
                Errors: [{ FileName: "errorFile", LogLevel: "", Text: "someErrorText", StartLine: 5, EndLine: 6, StartColumn: 7, EndColumn: 8 }]
            })
        ].forEach((event: OmnisharpServerMsBuildProjectDiagnostics) => {
            test(`Logged message contains the Filename, StartColumn, StartLine and Text for the diagnostic warnings`, () => {
                observer.post(event);
                event.diagnostics.Warnings.forEach(element => {
                    expect(logOutput).to.contain(element.FileName);
                    expect(logOutput).to.contain(element.StartLine);
                    expect(logOutput).to.contain(element.StartColumn);
                    expect(logOutput).to.contain(element.Text);
                });
            });

            test(`Logged message contains the Filename, StartColumn, StartLine and Text for the diagnostics errors`, () => {
                observer.post(event);
                event.diagnostics.Errors.forEach(element => {
                    expect(logOutput).to.contain(element.FileName);
                    expect(logOutput).to.contain(element.StartLine);
                    expect(logOutput).to.contain(element.StartColumn);
                    expect(logOutput).to.contain(element.Text);
                });
            });
        });
    });

    [
        new OmnisharpServerOnStdErr("on std error message"),
        new OmnisharpServerMessage("server message"),
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Message is logged`, () => {
            observer.post(event);
            expect(logOutput).to.contain(event.message);
        });
    });

    test(`OmnisharpServerOnServerError: Message is logged`, () => {
        let event = new OmnisharpServerOnServerError("on server error message");
        observer.post(event);
        expect(logOutput).to.contain(event.err);
    });


    [
        new OmnisharpInitialisation(new Date(5), "somePath"),
    ].forEach((event: OmnisharpInitialisation) => {
        test(`${event.constructor.name}: TimeStamp and SolutionPath are logged`, () => {
            observer.post(event);
            expect(logOutput).to.contain(event.timeStamp.toLocaleString());
            expect(logOutput).to.contain(event.solutionPath);
        });
    });

    test('OmnisharpFailure: Failure message is logged', () => {
        let event = new OmnisharpFailure("failureMessage", new Error("errorMessage"));
        observer.post(event);
        expect(logOutput).to.contain(event.message);
    });

    suite('OmnisharpEventPacketReceived', () => {
        [
            new OmnisharpEventPacketReceived("TRACE", "foo", "someMessage"),
            new OmnisharpEventPacketReceived("DEBUG", "foo", "someMessage"),
            new OmnisharpEventPacketReceived("INFORMATION", "foo", "someMessage"),
            new OmnisharpEventPacketReceived("WARNING", "foo", "someMessage"),
            new OmnisharpEventPacketReceived("ERROR", "foo", "someMessage"),
            new OmnisharpEventPacketReceived("CRITICAL", "foo", "someMessage"),
        ].forEach((event: OmnisharpEventPacketReceived) => {
            test(`${event.logLevel} messages are logged with name and the message`, () => {
                observer.post(event);
                expect(logOutput).to.contain(event.name);
                expect(logOutput).to.contain(event.message);
            });
        });

        test('Throws error on unknown log level', () => {
            let event = new OmnisharpEventPacketReceived("random log level", "foo", "someMessage");
            let fn = function () { observer.post(event); };
            expect(fn).to.throw(Error);
        });

        test(`Information messages with name OmniSharp.Middleware.LoggingMiddleware and follow pattern /^\/[\/\w]+: 200 \d+ms/ are not logged`, () => {
            let event = new OmnisharpEventPacketReceived("INFORMATION", "OmniSharp.Middleware.LoggingMiddleware", "/codecheck: 200 339ms");
            observer.post(event);
            expect(logOutput).to.be.empty;
        });
    });

    suite('OmnisharpLaunch', () => {
        [
            { 'event': new OmnisharpLaunch("5.8.0", undefined, "someCommand", 4), 'expected': "OmniSharp server started with Mono 5.8.0." },
            { 'event': new OmnisharpLaunch(undefined, undefined, "someCommand", 4), 'expected': "OmniSharp server started." },
            { 'event': new OmnisharpLaunch("5.8.0", "path to mono", "someCommand", 4), 'expected': "OmniSharp server started with Mono 5.8.0 (path to mono)." },
            { 'event': new OmnisharpLaunch(undefined, "path to mono", "someCommand", 4), 'expected': "OmniSharp server started." },
        ].forEach((data: { event: OmnisharpLaunch, expected: string }) => {
            const event = data.event;

            test(`Command and Pid are displayed`, () => {
                observer.post(event);
                expect(logOutput).to.contain(event.command);
                expect(logOutput).to.contain(event.pid);
            });

            test(`Message is displayed depending on monoVersion and monoPath value`, () => {
                observer.post(event);
                expect(logOutput).to.contain(data.expected);
            });
        });
    });

    suite('OmnisharpServerOnError', () => {
        test(`Doesnot throw error if FileName is null`, () => {
            let event = new OmnisharpServerOnError({ Text: "someText", FileName: null, Line: 1, Column: 2 });
            let fn = function () { observer.post(event); };
            expect(fn).to.not.throw(Error);
        });

        [
            new OmnisharpServerOnError({ Text: "someText", FileName: "someFile", Line: 1, Column: 2 }),
        ].forEach((event: OmnisharpServerOnError) => {
            test(`Contains the error message text`, () => {
                observer.post(event);
                expect(logOutput).to.contain(event.errorMessage.Text);
            });

            test(`Contains the error message FileName, Line and column if FileName is not null`, () => {
                observer.post(event);
                if (event.errorMessage.FileName) {
                    expect(logOutput).to.contain(event.errorMessage.FileName);
                    expect(logOutput).to.contain(event.errorMessage.Line);
                    expect(logOutput).to.contain(event.errorMessage.Column);
                }
            });
        });
    });
});
