/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { OmnisharpLoggerObserver } from '../../../src/observers/OmnisharpLoggerObserver';
import { OmnisharpServerMsBuildProjectDiagnostics } from '../../../src/omnisharp/loggingEvents';

suite("OmnisharpLoggerObserver", () => {
    suiteSetup(() => should());
    [
        /*new OmnisharpServerMsBuildProjectDiagnostics("someFile",
            [{ FileName: "warningFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }],
            [{ FileName: "errorFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }])*/
    ].forEach((event: OmnisharpServerMsBuildProjectDiagnostics) => {
        test(`Shows the channel for ${event.constructor.name}`, () => {
            let logOutput = "";
            let observer = new OmnisharpLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });
    
            observer.onNext(event);
            expect(logOutput).to.contain();
        });
    });
});
