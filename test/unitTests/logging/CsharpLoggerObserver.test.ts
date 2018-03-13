/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { CsharpLoggerObserver } from '../../../src/observers/CsharpLoggerObserver';
import { PlatformInformation } from '../../../src/platform';
import { PackageError } from '../../../src/packages';
import { DownloadStart, DownloadProgress, DownloadSuccess, DownloadFailure, BaseEvent, LogPlatformInfo, InstallationFailure, DebuggerPreRequisiteFailure, DebuggerPreRequisiteWarning, ActivationFailure, ProjectJsonDeprecatedWarning, InstallationSuccess, InstallationProgress, PackageInstallation } from '../../../src/omnisharp/loggingEvents';

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
            expected: "Started....................Done\n\n"
        },
        {
            events: [new DownloadStart("Started"), new DownloadProgress(50), new DownloadFailure("Failed")],
            expected: "Started..........Failed\n\n"
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
    let logOutput = "";
    let observer = new CsharpLoggerObserver({
        ...getNullChannel(),
        append: (text?: string) => { logOutput += text || ""; },
    });

    setup(() => {
        logOutput = "";
    });

    test('PlatformInfo: Logs contain the Platform and Architecture', () => {
        let event = new LogPlatformInfo(new PlatformInformation("MyPlatform", "MyArchitecture"));
        observer.post(event);
        expect(logOutput).to.contain("MyPlatform");
        expect(logOutput).to.contain("MyArchitecture");
    });

    test('InstallationFailure: Stage and Error is logged if not a PackageError', () => {
        let event = new InstallationFailure("someStage", new Error("someError"));
        observer.post(event);
        expect(logOutput).to.contain(event.stage);
        expect(logOutput).to.contain(event.error.toString());
    });

    test('InstallationFailure: Stage and Error is logged if a PackageError without inner error', () => {
        let event = new InstallationFailure("someStage", new PackageError("someError", null, null));
        observer.post(event);
        expect(logOutput).to.contain(event.stage);
        expect(logOutput).to.contain(event.error.message);
    });

    test('InstallationFailure: Stage and Inner error is logged if a PackageError without inner error', () => {
        let event = new InstallationFailure("someStage", new PackageError("someError", null, "innerError"));
        observer.post(event);
        expect(logOutput).to.contain(event.stage);
        expect(logOutput).to.contain(event.error.innerError.toString());
    });


    [
        {
            message: new DebuggerPreRequisiteFailure('Some failure message'),
            expected: `Some failure message`
        },
        {
            message: new DebuggerPreRequisiteWarning("Some warning message"),
            expected: `Some warning message`
        }
    ].forEach((element) =>
        test(`${element.message.constructor.name} is shown`, () => {
            observer.post(element.message);
            expect(logOutput).to.contain(element.expected);
        }));

    test(`ActivationFailure: Some message is logged`, () => {
        let event = new ActivationFailure();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`ProjectJsonDeprecatedWarning: Some message is logged`, () => {
        let event = new ProjectJsonDeprecatedWarning();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`ProjectJsonDeprecatedWarning: Some message is logged`, () => {
        let event = new InstallationSuccess();
        observer.post(event);
        expect(logOutput).to.not.be.empty;
    });

    test(`InstallationProgress: Progress message is logged`, () => {
        let event = new InstallationProgress("someStage", "someMessage");
        observer.post(event);
        expect(logOutput).to.contain(event.message);
    });

    test('PackageInstallation: Package name is logged', () => {
        let event = new PackageInstallation("somePackage");
        observer.post(event);
        expect(logOutput).to.contain(event.packageInfo);
    });

});
