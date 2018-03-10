/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { OmnisharpLoggerObserver } from '../../../src/observers/OmnisharpLoggerObserver';
import { OmnisharpServerMsBuildProjectDiagnostics, EventWithMessage, OmnisharpServerOnStdErr, OmnisharpServerMessage, OmnisharpServerOnServerError } from '../../../src/omnisharp/loggingEvents';

suite("OmnisharpLoggerObserver", () => {
    suiteSetup(() => should());
    /*[
        new OmnisharpServerMsBuildProjectDiagnostics("someFile",
            [{ FileName: "warningFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }],
            [{ FileName: "errorFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }])
    ].forEach((event: OmnisharpServerMsBuildProjectDiagnostics) => {
        test(`Shows the channel for ${event.constructor.name}`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

            observer.post(event);
            expect(logOutput).to.contain();
        });
    });*/

    [
        new OmnisharpServerOnStdErr("on std error message"),
        new OmnisharpServerMessage("server message"),
        new OmnisharpServerOnServerError("on server error message"),
    ].forEach((event: EventWithMessage) => {
        test(`Shows the channel for ${event.constructor.name}`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

            observer.post(event);
            expect(logOutput).to.contain(event.message);
        });
    });
});
