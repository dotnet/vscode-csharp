/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { CsharpLoggerObserver } from '../../../src/observers/CsharpLoggerObserver';
import { PlatformInformation } from '../../../src/platform';
import { PackageError } from '../../../src/packages';
import * as Event from '../../../src/omnisharp/loggingEvents';

suite("CsharpLoggerObserver: Download Messages", () => {
    suiteSetup(() => should());

    [
        {
            events: [],
            expected: ""
        },
        {
            events: [new Event.DownloadStart("Started")],
            expected: "Started"
        },
        {
            events: [new Event.DownloadStart("Started"), new Event.DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [new Event.DownloadStart("Started"), new Event.DownloadProgress(10), new Event.DownloadProgress(50), new Event.DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [new Event.DownloadStart("Started"), new Event.DownloadProgress(10), new Event.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [new Event.DownloadStart("Started"), new Event.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [new Event.DownloadStart("Started"), new Event.DownloadProgress(50), new Event.DownloadProgress(50), new Event.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [new Event.DownloadStart("Started"), new Event.DownloadProgress(100), new Event.DownloadSuccess("Done")],
            expected: "Started....................Done\n"
        },
        {
            events: [new Event.DownloadStart("Started"), new Event.DownloadProgress(50), new Event.DownloadFailure("Failed")],
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

            element.events.forEach((message: Event.BaseEvent) => observer.post(message));
            expect(logOutput).to.be.equal(element.expected);
        });
    });
});

suite('CsharpLoggerObsever', () => {
    suiteSetup(() => should());
    let logOutput = "";
    let observer = new CsharpLoggerObserver({
        ...getNullChannel(),
        append: (text?: string) => { logOutput += text || ""; },
    });

    setup(() => {
        logOutput = "";
    });

    test('PlatformInfo: Logs contain the Platform and Architecture', () => {
        let event = new Event.LogPlatformInfo(new PlatformInformation("MyPlatform", "MyArchitecture"));
        observer.post(event);
        expect(logOutput).to.contain("MyPlatform");
        expect(logOutput).to.contain("MyArchitecture");
    });

    test('InstallationFailure: Stage and Error is logged if not a PackageError', () => {
        let event = new Event.InstallationFailure("someStage", new Error("someError"));
        observer.post(event);
        expect(logOutput).to.contain(event.stage);
        expect(logOutput).to.contain(event.error.toString());
    });

    test('InstallationFailure: Stage and Error is logged if a PackageError without inner error', () => {
        let event = new Event.InstallationFailure("someStage", new PackageError("someError", null, null));
        observer.post(event);
        expect(logOutput).to.contain(event.stage);
        expect(logOutput).to.contain(event.error.message);
    });

    test('InstallationFailure: Stage and Inner error is logged if a PackageError without inner error', () => {
        let event = new Event.InstallationFailure("someStage", new PackageError("someError", null, "innerError"));
        observer.post(event);
        expect(logOutput).to.contain(event.stage);
        expect(logOutput).to.contain(event.error.innerError.toString());
    });


    [
        {
            message: new Event.DebuggerPrerequisiteFailure('Some failure message'),
            expected: `Some failure message`
        },
        {
            message: new Event.DebuggerPrerequisiteWarning("Some warning message"),
            expected: `Some warning message`
        }
    ].forEach((element) =>
        test(`${element.message.constructor.name} is shown`, () => {
            observer.post(element.message);
            expect(logOutput).to.contain(element.expected);
        }));

    test(`ActivaltionFailure: Some message is logged`, () => {
        let event = new Event.ActivationFailure();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`ProjectJsonDeprecatedWarning: Some message is logged`, () => {
        let event = new Event.ProjectJsonDeprecatedWarning();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`ProjectJsonDeprecatedWarning: Some message is logged`, () => {
        let event = new Event.InstallationSuccess();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`InstallationProgress: Progress message is logged`, () => {
        let event = new Event.InstallationProgress("someStage", "someMessage");
        observer.post(event);
        expect(logOutput).to.contain(event.message);
    });

    test('PackageInstallation: Package name is logged', () => {
        let event = new Event.PackageInstallation("somePackage");
        observer.post(event);
        expect(logOutput).to.contain(event.packageInfo);
    });
});
