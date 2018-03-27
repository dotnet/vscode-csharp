/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullTelemetryReporter } from './Fakes';
import { TelemetryObserver } from '../../../src/observers/TelemetryObserver';
import { PlatformInformation } from '../../../src/platform';
import { PackageInstallation, InstallationFailure, InstallationSuccess, TestExecutionCountReport, TelemetryEventWithMeasures, OmnisharpDelayTrackerEventMeasures, OmnisharpStart } from '../../../src/omnisharp/loggingEvents';
import { PackageError, Package } from '../../../src/packages';

const chai = require('chai');
chai.use(require('chai-arrays'));

suite('TelemetryReporterObserver', () => {
    suiteSetup(() => should());
    let platformInfo = new PlatformInformation("platform", "architecture");
    let name = "";
    let property = null;
    let measure = [];
    let observer = new TelemetryObserver(platformInfo, () => {
        return {
            ...getNullTelemetryReporter,
            sendTelemetryEvent: (eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }) => {
                name += eventName;
                property = properties;
                measure.push(measures);
            }
        };
    });

    setup(() => {
        name = "";
        property = null;
        measure = [];
    });

    test('PackageInstallation: AcquisitionStart is reported', () => {
        let event = new PackageInstallation("somePackage");
        observer.post(event);
        expect(name).to.be.not.empty;
    });

    suite('InstallationFailure', () => {
        test("Telemetry Props contains platform information, install stage and an event name", () => {
            let event = new InstallationFailure("someStage", "someError");
            observer.post(event);
            expect(property).to.have.property("platform.architecture", platformInfo.architecture);
            expect(property).to.have.property("platform.platform", platformInfo.platform);
            expect(property).to.have.property("installStage");
            expect(name).to.not.be.empty;
        });
    
        test(`Telemetry Props contains message and packageUrl if error is package error`, () => {
            let error = new PackageError("someError", <Package>{ "description": "foo", "url": "someurl" });
            let event = new InstallationFailure("someStage", error);
            observer.post(event);
            expect(property).to.have.property("error.message", error.message);
            expect(property).to.have.property("error.packageUrl", error.pkg.url);
        }); 
    });

    test('InstallationSuccess: Telemetry props contain installation stage', () => {
        let event = new InstallationSuccess();
        observer.post(event);
        expect(name).to.be.equal("Acquisition");
        expect(property).to.have.property("installStage", "completeSuccess");
    });

    suite('TestCountExecutionReport', () => {
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

    [
        new OmnisharpDelayTrackerEventMeasures("someEvent", { someKey: 1 }),
        new OmnisharpStart("startEvent", { someOtherKey: 2 })
    ].forEach((event: TelemetryEventWithMeasures) => {
        test(`${event.constructor.name}`, () => {
            observer.post(event);
            expect(name).to.contain(event.eventName);
            expect(measure).to.be.containingAllOf([event.measures]);
        });
    });
   
});
