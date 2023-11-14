/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, test, describe, expect } from '@jest/globals';
import { TelemetryObserver } from '../../../src/observers/telemetryObserver';
import { PlatformInformation } from '../../../src/shared/platform';
import {
    PackageInstallation,
    InstallationFailure,
    InstallationSuccess,
    TestExecutionCountReport,
    TelemetryEventWithMeasures,
    OmnisharpDelayTrackerEventMeasures,
    OmnisharpStart,
    TelemetryEvent,
    ProjectConfiguration,
    TelemetryErrorEvent,
} from '../../../src/omnisharp/loggingEvents';
import { getNullTelemetryReporter } from '../../../test/unitTests/fakes';
import { Package } from '../../../src/packageManager/package';
import { PackageError } from '../../../src/packageManager/packageError';
import { isNotNull } from '../../testUtil';

describe('TelemetryReporterObserver', () => {
    const platformInfo = new PlatformInformation('linux', 'architecture');
    let name = '';
    let property: { [key: string]: string } | undefined = undefined;
    let measure: { [key: string]: number }[] = [];
    let errorProp: string[] = [];
    const useModernNet = true;
    const observer = new TelemetryObserver(
        platformInfo,
        () => {
            return {
                ...getNullTelemetryReporter,
                sendTelemetryEvent: (
                    eventName: string,
                    properties?: { [key: string]: string },
                    measures?: { [key: string]: number }
                ) => {
                    name += eventName;
                    property = properties;
                    measure.push(measures!);
                },
                sendTelemetryErrorEvent: (
                    eventName: string,
                    properties?: { [key: string]: string },
                    measures?: { [key: string]: number },
                    errorProps?: string[]
                ) => {
                    name += eventName;
                    property = properties;
                    measure.push(measures!);
                    errorProps!.forEach((prop) => {
                        errorProp.push(prop);
                    });
                },
            };
        },
        useModernNet
    );

    beforeEach(() => {
        name = '';
        property = undefined;
        measure = [];
        errorProp = [];
    });

    test('PackageInstallation: AcquisitionStart is reported', () => {
        const event = new PackageInstallation('somePackage');
        observer.post(event);
        expect(name.length).toBeGreaterThan(0);
    });

    test('InstallationSuccess: Telemetry props contain installation stage', () => {
        const event = new InstallationSuccess();
        observer.post(event);
        expect(name).toEqual('AcquisitionSucceeded');
        expect(property).toHaveProperty('installStage', 'completeSuccess');
    });

    test(`${ProjectConfiguration.name}: Telemetry props contains project id and target framework`, () => {
        const targetFrameworks = ['tfm1', 'tfm2'];
        const projectId = 'sample';
        const sessionId = 'session01';
        const outputKind = 3;
        const projectCapabilities = ['cap1', 'cap2'];
        const references = ['ref1', 'ref2'];
        const fileExtensions = ['.cs', '.cshtml'];
        const fileCounts = [7, 3];
        const sdkStyleProject = true;
        const event = new ProjectConfiguration({
            ProjectCapabilities: projectCapabilities,
            TargetFrameworks: targetFrameworks,
            ProjectId: projectId,
            SessionId: sessionId,
            OutputKind: outputKind,
            References: references,
            FileExtensions: fileExtensions,
            FileCounts: fileCounts,
            SdkStyleProject: sdkStyleProject,
        });

        observer.post(event);
        isNotNull(property);
        expect(property['ProjectCapabilities']).toEqual('cap1 cap2');
        expect(property['TargetFrameworks']).toEqual('tfm1|tfm2');
        expect(property['ProjectId']).toEqual(projectId);
        expect(property['SessionId']).toEqual(sessionId);
        expect(property['OutputType']).toEqual(outputKind.toString());
        expect(property['References']).toEqual('ref1|ref2');
        expect(property['FileExtensions']).toEqual('.cs|.cshtml');
        expect(property['FileCounts']).toEqual('7|3');
        expect(property['useModernNet']).toEqual('true');
        expect(property['sdkStyleProject']).toEqual('true');
    });

    [
        new OmnisharpDelayTrackerEventMeasures('someEvent', { someKey: 1 }),
        new OmnisharpStart('startEvent', { someOtherKey: 2 }),
    ].forEach((event: TelemetryEventWithMeasures) => {
        test(`${event.constructor.name}: SendTelemetry event is called with the name and measures`, () => {
            observer.post(event);
            expect(name).toContain(event.eventName);
            expect(measure).toMatchObject([event.measures]);
        });
    });

    test(`${TelemetryEvent.name}: SendTelemetry event is called with the name, properties and measures`, () => {
        const event = new TelemetryEvent('someName', { key: 'value' }, { someKey: 1 });
        observer.post(event);
        expect(name).toContain(event.eventName);
        expect(measure).toMatchObject([event.measures!]);
        expect(property).toEqual(event.properties);
    });

    test(`${TelemetryErrorEvent.name}: SendTelemetry error event is called with the name, properties, measures, and errorProps`, () => {
        const event = new TelemetryErrorEvent('someName', { key: 'value' }, { someKey: 1 }, ['StackTrace']);
        observer.post(event);
        expect(name).toContain(event.eventName);
        expect(measure).toMatchObject([event.measures!]);
        expect(property).toEqual(event.properties);
        expect(errorProp).toEqual(event.errorProps!);
    });

    describe('InstallationFailure', () => {
        test('Telemetry Props contains platform information, install stage and an event name', () => {
            const event = new InstallationFailure('someStage', 'someError');
            observer.post(event);
            expect(name).toEqual('AcquisitionFailed');
            expect(property!['platform.architecture']).toEqual(platformInfo.architecture);
            expect(property!['platform.platform']).toEqual(platformInfo.platform);
            expect(property!['installStage']).toBeDefined();
        });

        test(`Telemetry Props contains message and packageUrl if error is package error`, () => {
            const error = new PackageError('someError', <Package>{ description: 'foo', url: 'someurl' }, undefined);
            const event = new InstallationFailure('someStage', error);
            observer.post(event);
            expect(name).toEqual('AcquisitionFailed');
            expect(property!['error.message']).toEqual(error.message);
            expect(property!['error.packageUrl']).toEqual(error.pkg.url);
        });
    });

    describe('TestExecutionCountReport', () => {
        test('SendTelemetryEvent is called for "RunTest" and "DebugTest"', () => {
            const event = new TestExecutionCountReport({ framework1: 20 }, { framework2: 30 });
            observer.post(event);
            expect(name).toContain('RunTest');
            expect(name).toContain('DebugTest');
            expect(measure).toMatchObject([event.debugCounts!, event.runCounts!]);
        });

        test('SendTelemetryEvent is not called for empty run count', () => {
            const event = new TestExecutionCountReport({ framework1: 20 }, undefined!);
            observer.post(event);
            expect(name).not.toContain('RunTest');
            expect(name).toContain('DebugTest');
            expect(measure).toMatchObject([event.debugCounts!]);
        });

        test('SendTelemetryEvent is not called for empty debug count', () => {
            const event = new TestExecutionCountReport(undefined!, { framework1: 20 });
            observer.post(event);
            expect(name).toContain('RunTest');
            expect(name).not.toContain('DebugTest');
            expect(measure).toMatchObject([event.runCounts!]);
        });

        test('SendTelemetryEvent is not called for empty debug and run counts', () => {
            const event = new TestExecutionCountReport(undefined!, undefined!);
            observer.post(event);
            expect(name).toBeFalsy();
            expect(measure).toHaveLength(0);
        });
    });
});
