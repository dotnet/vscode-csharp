/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { TelemetryObserver } from '../../../src/observers/TelemetryObserver';
import { PlatformInformation } from '../../../src/platform';
import { PackageInstallation, InstallationFailure, InstallationSuccess, TestExecutionCountReport, TelemetryEventWithMeasures, OmnisharpDelayTrackerEventMeasures, OmnisharpStart, TelemetryEvent, ProjectConfiguration, TelemetryErrorEvent } from '../../../src/omnisharp/loggingEvents';
import { getNullTelemetryReporter } from '../testAssets/Fakes';
import { Package } from '../../../src/packageManager/Package';
import { PackageError } from '../../../src/packageManager/PackageError';

const chai = require('chai');
chai.use(require('chai-arrays'));

suite('TelemetryReporterObserver', () => {
    suiteSetup(() => should());
    let platformInfo = new PlatformInformation("platform", "architecture");
    let name = "";
    let property: { [key: string]: string } = null;
    let measure: { [key: string]: number }[] = [];
    let errorProp: string[][] = [];
    let observer = new TelemetryObserver(platformInfo, () => {
        return {
            ...getNullTelemetryReporter,
            sendTelemetryEvent: (eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }) => {
                name += eventName;
                property = properties;
                measure.push(measures);
            },
            sendTelemetryErrorEvent: (eventName: string, properties?: { [key: string]: string; }, measures?: { [key: string]: number; }, errorProps?: string[]) => {
                name += eventName;
                property = properties;
                measure.push(measures);
                errorProp.push(errorProps);
            },
        };
    });

    setup(() => {
        name = "";
        property = null;
        measure = [];
        errorProp = [];
    });

    test('PackageInstallation: AcquisitionStart is reported', () => {
        let event = new PackageInstallation("somePackage");
        observer.post(event);
        expect(name).to.be.not.empty;
    });

    test('InstallationSuccess: Telemetry props contain installation stage', () => {
        let event = new InstallationSuccess();
        observer.post(event);
        expect(name).to.be.equal("AcquisitionSucceeded");
        expect(property).to.have.property("installStage", "completeSuccess");
    });

    test(`${ProjectConfiguration.name}: Telemetry props contains project id and target framework`, () => {
        const targetFrameworks = ["tfm1", "tfm2"];
        const projectId = "sample";
        const sessionId = "session01";
        const outputKind = 3;
        const projectCapabilities = ["cap1", "cap2"];
        const references = ["ref1", "ref2"];
        const fileExtensions = [".cs", ".cshtml"];
        const fileCounts = [7, 3];
        let event = new ProjectConfiguration({
            ProjectCapabilities: projectCapabilities,
            TargetFrameworks: targetFrameworks,
            ProjectId: projectId,
            SessionId: sessionId,
            OutputKind: outputKind,
            References: references,
            FileExtensions: fileExtensions,
            FileCounts: fileCounts
        });

        observer.post(event);
        expect(property["ProjectCapabilities"]).to.be.equal("cap1 cap2");
        expect(property["TargetFrameworks"]).to.be.equal("tfm1|tfm2");
        expect(property["ProjectId"]).to.be.equal(projectId);
        expect(property["SessionId"]).to.be.equal(sessionId);
        expect(property["OutputType"]).to.be.equal(outputKind.toString());
        expect(property["References"]).to.be.equal("ref1|ref2");
        expect(property["FileExtensions"]).to.be.equal(".cs|.cshtml");
        expect(property["FileCounts"]).to.be.equal("7|3");
    });

    [
        new OmnisharpDelayTrackerEventMeasures("someEvent", { someKey: 1 }),
        new OmnisharpStart("startEvent", { someOtherKey: 2 })
    ].forEach((event: TelemetryEventWithMeasures) => {
        test(`${event.constructor.name}: SendTelemetry event is called with the name and measures`, () => {
            observer.post(event);
            expect(name).to.contain(event.eventName);
            expect(measure).to.be.containingAllOf([event.measures]);
        });
    });

    test(`${TelemetryEvent.name}: SendTelemetry event is called with the name, properties and measures`, () => {
        let event = new TelemetryEvent("someName", { "key": "value" }, { someKey: 1 });
        observer.post(event);
        expect(name).to.contain(event.eventName);
        expect(measure).to.be.containingAllOf([event.measures]);
        expect(property).to.be.equal(event.properties);
    });

    test(`${TelemetryErrorEvent.name}: SendTelemetry error event is called with the name, properties, measures, and errorProps`, () => {
        let event = new TelemetryErrorEvent("someName", { "key": "value" }, { someKey: 1 }, ["StackTrace"]);
        observer.post(event);
        expect(name).to.contain(event.eventName);
        expect(measure).to.be.containingAllOf([event.measures]);
        expect(property).to.be.equal(event.properties);
        expect(errorProp).to.be.containingAllOf([event.errorProps]);
    });

    suite('InstallationFailure', () => {
        test("Telemetry Props contains platform information, install stage and an event name", () => {
            let event = new InstallationFailure("someStage", "someError");
            observer.post(event);
            expect(name).to.be.equal("AcquisitionFailed");
            expect(property).to.have.property("platform.architecture", platformInfo.architecture);
            expect(property).to.have.property("platform.platform", platformInfo.platform);
            expect(property).to.have.property("installStage");
        });

        test(`Telemetry Props contains message and packageUrl if error is package error`, () => {
            let error = new PackageError("someError", <Package>{ "description": "foo", "url": "someurl" });
            let event = new InstallationFailure("someStage", error);
            observer.post(event);
            expect(name).to.be.equal("AcquisitionFailed");
            expect(property).to.have.property("error.message", error.message);
            expect(property).to.have.property("error.packageUrl", error.pkg.url);
        });
    });

    suite('TestExecutionCountReport', () => {
        test('SendTelemetryEvent is called for "RunTest" and "DebugTest"', () => {
            let event = new TestExecutionCountReport({ "framework1": 20 }, { "framework2": 30 });
            observer.post(event);
            expect(name).to.contain("RunTest");
            expect(name).to.contain("DebugTest");
            expect(measure).to.be.containingAllOf([event.debugCounts, event.runCounts]);
        });

        test('SendTelemetryEvent is not called for empty run count', () => {
            let event = new TestExecutionCountReport({ "framework1": 20 }, null);
            observer.post(event);
            expect(name).to.not.contain("RunTest");
            expect(name).to.contain("DebugTest");
            expect(measure).to.be.containingAllOf([event.debugCounts]);
        });

        test('SendTelemetryEvent is not called for empty debug count', () => {
            let event = new TestExecutionCountReport(null, { "framework1": 20 });
            observer.post(event);
            expect(name).to.contain("RunTest");
            expect(name).to.not.contain("DebugTest");
            expect(measure).to.be.containingAllOf([event.runCounts]);
        });

        test('SendTelemetryEvent is not called for empty debug and run counts', () => {
            let event = new TestExecutionCountReport(null, null);
            observer.post(event);
            expect(name).to.be.empty;
            expect(measure).to.be.empty;
        });
    });
});
