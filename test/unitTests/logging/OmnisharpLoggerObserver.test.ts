/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { OmnisharpLoggerObserver } from '../../../src/observers/OmnisharpLoggerObserver';
import { OmnisharpServerMsBuildProjectDiagnostics, EventWithMessage, OmnisharpServerOnStdErr, OmnisharpServerMessage, OmnisharpServerOnServerError, OmnisharpInitialisation, OmnisharpLaunch, OmnisharpServerOnError } from '../../../src/omnisharp/loggingEvents';
import { MSBuildDiagnosticsMessage } from '../../../src/omnisharp/protocol';

suite("OmnisharpLoggerObserver", () => {
    suiteSetup(() => should());
    [
        new OmnisharpServerMsBuildProjectDiagnostics({
            FileName: "someFile",
            Warnings: [{ FileName: "warningFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }],
            Errors: [{ FileName: "errorFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }]
        })
    ].forEach((event: OmnisharpServerMsBuildProjectDiagnostics) => {
        test(`${event.constructor.name}: Logged message contains the Filename`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

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
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

            observer.post(event);
            event.diagnostics.Warnings.forEach(element => {
                expect(logOutput).to.contain(element.FileName);
                expect(logOutput).to.contain(element.StartLine);
                expect(logOutput).to.contain(element.StartColumn);
                expect(logOutput).to.contain(element.Text);
            });
        });

        test(`${event.constructor.name}: Logged message contains the Filename, StartColumn, StartLine and Text for the diagnostics errors`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

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
        test(`${event.constructor.name}: Message is displayed`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

            observer.post(event);
            expect(logOutput).to.contain(event.message);
        });
    });

    [
        new OmnisharpInitialisation(new Date(5), "somePath"),
    ].forEach((event: OmnisharpInitialisation) => {
        test(`${event.constructor.name}: TimeStamp and SolutionPath are displayed`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

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
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

            observer.post(event);
            expect(logOutput).to.contain(event.command);
            expect(logOutput).to.contain(event.pid);
        });
        test(`${event.constructor.name}: Message is displayed depending on usingMono value`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });
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
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

            observer.post(event);
            expect(logOutput).to.contain(event.errorMessage.Text);
        });

        test(`${event.constructor.name}: Contains the error message FileName, Line and column if FileName is not null`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });
            observer.post(event);
            if (event.errorMessage.FileName) {
                expect(logOutput).to.contain(event.errorMessage.FileName);
                expect(logOutput).to.contain(event.errorMessage.Line);
                expect(logOutput).to.contain(event.errorMessage.Column);
            }
        });
    });

    test(`OmnisharpServerOnError: Doesnot throw error if FileName is null`, () => {
        let event = new OmnisharpServerOnError({ Text: "someText", FileName: null, Line: 1, Column: 2 })
        let logOutput = "";
        let observer = new OmnisharpLoggerObserver({
            ...getNullChannel(),
            append: (text: string) => { logOutput += text; },
        });

        let fn = function () { observer.post(event); };
        expect(fn).to.not.throw(Error);
    });
});
