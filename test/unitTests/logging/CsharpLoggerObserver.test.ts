/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { CsharpLoggerObserver } from '../../../src/observers/CsharpLoggerObserver';
import { PlatformInformation } from '../../../src/platform';
import { PackageError } from '../../../src/packages';
import { DownloadStart, DownloadProgress, DownloadSuccess, DownloadFailure, BaseEvent, PlatformInfoEvent, InstallationFailure, DebuggerPreRequisiteFailure, DebuggerPreRequisiteWarning } from '../../../src/omnisharp/loggingEvents';

suite("CsharpLoggerObserver: Download Messages", () => {
    suiteSetup(() => should());

    [
        {
            events: [],
            expected: ""
        },
        {
            events: [new DownloadStart("Started")],
            expected: "Started"
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(10), new DownloadProgress(50), new DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(10), new DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(50), new DownloadProgress(50), new DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(100), new DownloadSuccess("Done")],
            expected: "Started....................Done\n"
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(50), new DownloadFailure("Failed")],
            expected: "Started..........Failed\n"
        },
    ].forEach((element) => {
        test(`Prints the download status to the logger as ${element.expected}`, () => {
            let logOutput = "";

            let observer = new CsharpLoggerObserver({
                ...getNullChannel(),
                appendLine: (text?: string) => { logOutput += `${text}\n`; },
                append: (text?: string) => { logOutput += text; }
            });

            element.events.forEach((message: BaseEvent) => observer.post(message));
            expect(logOutput).to.be.equal(element.expected);
        });
    });
});

suite('CsharpLoggerObsever', () => {
    suiteSetup(() => should());
    test('PlatformInfo: Logs contain the Platform and Architecture', () => {
        let logOutput = "";
        let observer = new CsharpLoggerObserver({
            ...getNullChannel(),
            append: (text?: string) => { logOutput += text ? text : "\n"; }
        });

        let message = new PlatformInfoEvent(new PlatformInformation("MyPlatform", "MyArchitecture"));

        observer.post(message);
        expect(logOutput).to.contain("MyPlatform");
        expect(logOutput).to.contain("MyArchitecture");
    });

    [
        {
            stage: "someStage",
            error: "someError"
        },
        {
            stage: "someStage",
            error: new PackageError("someError", null, "innerError")
        }
    ].forEach((element) =>
        test('InstallationFailure: Stage, Error and Inner Errors are logged', () => {
            let message = new InstallationFailure(element.stage, element.error);
            let logOutput = "";
            let observer = new CsharpLoggerObserver({
                ...getNullChannel(),
                append: (text?: string) => { logOutput += text || ""; },
            });

            observer.post(message);
            expect(logOutput).to.contain(element.stage);
            if (element.error instanceof PackageError) {
                expect(logOutput).to.contain(element.error.innerError.toString());
            } 
            else {
                expect(logOutput).to.contain(element.error.toString());
            }
        }));

    [
        {
            message: new DebuggerPreRequisiteFailure('Some failure message'),
            expected: `Some failure message\n`
        },
        {
            message: new DebuggerPreRequisiteWarning("Some warning message"),
            expected: `Some warning message\n`
        }
    ].forEach((element) =>
        test(`${element.message.constructor.name} is shown`, () => {
            let logOutput = "";
            let observer = new CsharpLoggerObserver({
                ...getNullChannel(),
                append: (text?: string) => { logOutput += text || ""; },
            });

            observer.post(element.message);
            expect(logOutput).to.contain(element.expected);
        }));
});
