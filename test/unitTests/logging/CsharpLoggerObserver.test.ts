/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { MessageType, Message } from '../../../src/omnisharp/messageType';
import { getNullChannel } from './Fakes';
import * as CreateMessage from './CreateMessage';
import { CsharpLoggerObserver } from '../../../src/observers/CsharpLoggerObserver';
import { PlatformInformation } from '../../../src/platform';
import { PackageError } from '../../../src/packages';

suite("CsharpLoggerObserver: Download Messages", () => {
    suiteSetup(() => should());

    [
        {
            events: [],
            expected: ""
        },
        {
            events: [CreateMessage.DownloadStart("Started")],
            expected: "Started"
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(10), CreateMessage.DownloadProgress(50), CreateMessage.DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(10), CreateMessage.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(50), CreateMessage.DownloadProgress(50), CreateMessage.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(100), CreateMessage.DownloadSuccess("Done")],
            expected: "Started....................Done\n"
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(50), CreateMessage.DownloadFailure("Failed")],
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

            element.events.forEach((message: Message) => observer.onNext(message));
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

        let message = <Message>{
            type: MessageType.PlatformInfo,
            info: new PlatformInformation("MyPlatform", "MyArchitecture")
        };

        observer.onNext(message);
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
            let message = CreateMessage.InstallationFailure(element.stage, element.error);
            let logOutput = "";
            let observer = new CsharpLoggerObserver({
                ...getNullChannel(),
                append: (text?: string) => { logOutput += text || ""; },
            });

            observer.onNext(message);
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
            message: CreateMessage.DebuggerPreRequisiteFailure('Some failure message'),
            expected: `Some failure message\n`
        },
        {
            message: CreateMessage.DebuggerPreRequisiteWarning("Some warning message"),
            expected: `Some warning message\n`
        }
    ].forEach((element) =>
        test(`${CreateMessage.DisplayMessageType(element.message)} is shown`, () => {
            let logOutput = "";
            let observer = new CsharpLoggerObserver({
                ...getNullChannel(),
                append: (text?: string) => { logOutput += text || ""; },
            });

            observer.onNext(element.message);
            expect(logOutput).to.contain(element.expected);
        }));
});
