/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { OmnisharpLoggerObserver } from '../../../src/observers/OmnisharpLoggerObserver';
import { OmnisharpServerMsBuildProjectDiagnostics, EventWithMessage, OmnisharpServerOnStdErr, OmnisharpServerMessage, OmnisharpServerOnServerError, OmnisharpInitialisation, OmnisharpLaunch, OmnisharpServerOnError, OmnisharpFailure, OmnisharpEventPacketReceived } from '../../../src/omnisharp/loggingEvents';
import { MSBuildDiagnosticsMessage } from '../../../src/omnisharp/protocol';

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

    [
        new OmnisharpServerMsBuildProjectDiagnostics({
            FileName: "someFile",
            Warnings: [{ FileName: "warningFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }],
            Errors: [{ FileName: "errorFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }]
        })
    ].forEach((event: OmnisharpServerMsBuildProjectDiagnostics) => {
        test(`${event.constructor.name}: Logged message contains the Filename`, () => {
            observer.post(event);
            expect(logOutput).to.contain(event.diagnostics.FileName);
        });
    });

    [
        new OmnisharpServerMsBuildProjectDiagnostics({
            FileName: "someFile",
            Warnings: [{ FileName: "warningFile", LogLevel: "", Text: "someWarningText", StartLine: 1, EndLine: 2, StartColumn: 3, EndColumn: 4 }],
            Errors: [{ FileName: "errorFile", LogLevel: "", Text: "someErrorText", StartLine: 5, EndLine: 6, StartColumn: 7, EndColumn: 8 }]
        })
    ].forEach((event: OmnisharpServerMsBuildProjectDiagnostics) => {
        test(`${event.constructor.name}: Logged message contains the Filename, StartColumn, StartLine and Text for the diagnostic warnings`, () => {
            observer.post(event);
            event.diagnostics.Warnings.forEach(element => {
                expect(logOutput).to.contain(element.FileName);
                expect(logOutput).to.contain(element.StartLine);
                expect(logOutput).to.contain(element.StartColumn);
                expect(logOutput).to.contain(element.Text);
            });
        });

        test(`${event.constructor.name}: Logged message contains the Filename, StartColumn, StartLine and Text for the diagnostics errors`, () => {
            observer.post(event);
            event.diagnostics.Errors.forEach(element => {
                expect(logOutput).to.contain(element.FileName);
                expect(logOutput).to.contain(element.StartLine);
                expect(logOutput).to.contain(element.StartColumn);
                expect(logOutput).to.contain(element.Text);
            });
        });
    });

    [
        new OmnisharpServerOnStdErr("on std error message"),
        new OmnisharpServerMessage("server message"),
        new OmnisharpServerOnServerError("on server error message"),
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Message is logged`, () => {
            observer.post(event);
            expect(logOutput).to.contain(event.message);
        });
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

    [
        new OmnisharpLaunch(true, "someCommand", 4),
        new OmnisharpLaunch(false, "someCommand", 4)
    ].forEach((event: OmnisharpLaunch) => {
        test(`${event.constructor.name}: Command and Pid are displayed`, () => {
            observer.post(event);
            expect(logOutput).to.contain(event.command);
            expect(logOutput).to.contain(event.pid);
        });
        test(`${event.constructor.name}: Message is displayed depending on usingMono value`, () => {
            observer.post(event);
            if (event.usingMono) {
                expect(logOutput).to.contain("OmniSharp server started with Mono");
            }
            else {
                expect(logOutput).to.contain("OmniSharp server started");
            }
        });
    });

    [
        new OmnisharpServerOnError({ Text: "someText", FileName: "someFile", Line: 1, Column: 2 }),
    ].forEach((event: OmnisharpServerOnError) => {
        test(`${event.constructor.name}: Contains the error message text`, () => {
            observer.post(event);
            expect(logOutput).to.contain(event.errorMessage.Text);
        });

        test(`${event.constructor.name}: Contains the error message FileName, Line and column if FileName is not null`, () => {
            observer.post(event);
            if (event.errorMessage.FileName) {
                expect(logOutput).to.contain(event.errorMessage.FileName);
                expect(logOutput).to.contain(event.errorMessage.Line);
                expect(logOutput).to.contain(event.errorMessage.Column);
            }
        });
    });

    test(`OmnisharpServerOnError: Doesnot throw error if FileName is null`, () => {
        let event = new OmnisharpServerOnError({ Text: "someText", FileName: null, Line: 1, Column: 2 });
        let fn = function () { observer.post(event); };
        expect(fn).to.not.throw(Error);
    });

    test('OmnisharpFailure: Failure message is logged', () => {
        let event = new OmnisharpFailure("failureMessage", new Error("errorMessage"));
        observer.post(event);
        expect(logOutput).to.contain(event.message);
    });

    [
        new OmnisharpEventPacketReceived("TRACE", "foo", "someMessage"),
        new OmnisharpEventPacketReceived("DEBUG", "foo", "someMessage"),
        new OmnisharpEventPacketReceived("INFORMATION", "foo", "someMessage"),
        new OmnisharpEventPacketReceived("WARNING", "foo", "someMessage"),
        new OmnisharpEventPacketReceived("ERROR", "foo", "someMessage"),
        new OmnisharpEventPacketReceived("CRITICAL", "foo", "someMessage"),
    ].forEach((event: OmnisharpEventPacketReceived) => {
        test(`OmnisharpEventPacketReceived: ${event.logLevel} messages are logged with name and the message`, () => {
            observer.post(event);
            expect(logOutput).to.contain(event.name);
            expect(logOutput).to.contain(event.message);
        });
    });

    test('OmnisharpEventPacketReceived: Throws error on unknown log level', () => {
        let event = new OmnisharpEventPacketReceived("random log level", "foo", "someMessage");
        let fn = function () { observer.post(event); };
        expect(fn).to.throw(Error);
    });

    test(`OmnisharpEventPacketReceived: Information messages with name OmniSharp.Middleware.LoggingMiddleware and follow pattern /^\/[\/\w]+: 200 \d+ms/ are not logged`, () => {
        let event = new OmnisharpEventPacketReceived("INFORMATION", "OmniSharp.Middleware.LoggingMiddleware", "/codecheck: 200 339ms");
        observer.post(event);
        expect(logOutput).to.be.empty;
    });
});
