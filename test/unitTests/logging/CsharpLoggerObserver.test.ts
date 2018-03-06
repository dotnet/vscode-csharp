/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { MessageType, Message } from '../../../src/omnisharp/messageType';
import { getNullLogger } from './Fakes';
import * as CreateMessage from './CreateMessage';
import { CsharpLoggerObserver } from '../../../src/omnisharp/observers/CsharpLoggerObserver';
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
            let observer = new CsharpLoggerObserver(() => ({
                ...getNullLogger(),
                appendLine: (text?: string) => { logOutput += `${text}\n`; },
                append: (text?: string) => { logOutput += text; }
            }));

            element.events.forEach((message: Message) => observer.onNext(message));
            expect(logOutput).to.be.equal(element.expected);
        });
    });
});

suite('CsharpLoggerObsever', () => {
    suiteSetup(() => should());
    test('PlatformInfo: AppendLine platform info and a blank', () => {
        let logOutput = "";
        let observer = new CsharpLoggerObserver(() => ({
            ...getNullLogger(),
            appendLine: (text?: string) => { logOutput += text ? text : "\n"; }
        }));

        let message = <Message>{
            type: MessageType.PlatformInfo,
            info: new PlatformInformation("MyPlatform", "MyArchitecture")
        };

        let expected = "Platform: MyPlatform, MyArchitecture\n";
        observer.onNext(message);
        expect(logOutput).to.be.equal(expected);
    });

    [
        {
            message: CreateMessage.InstallationFailure("someStage", "someError"),
            expected: `Failed at stage: someStage\nsomeError\n\n`
        },
        {
            message: CreateMessage.InstallationFailure("someStage", new PackageError("someError", null, "innerError")),
            expected: `Failed at stage: someStage\ninnerError\n\n`
        }
    ].forEach((element) =>
        test('InstallationFailure: AppendLine stage, error or inner error and a blank', () => {
            let logOutput = "";
            let observer = new CsharpLoggerObserver(() => ({
                ...getNullLogger(),
                appendLine: (text?: string) => { logOutput += text ? `${text}\n` : "\n"; },
            }));

            observer.onNext(element.message);
            expect(logOutput).to.be.equal(element.expected);
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
        test(`AppendLine for ${CreateMessage.DisplayMessageType(element.message)}`, () => {
            let logOutput = "";
            let observer = new CsharpLoggerObserver(() => ({
                ...getNullLogger(),
                appendLine: (text?: string) => { logOutput += text ? `${text}\n` : "\n"; },
            }));

            observer.onNext(element.message);
            expect(logOutput).to.be.equal(element.expected);
        }));
});
