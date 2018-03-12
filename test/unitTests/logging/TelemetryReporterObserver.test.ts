/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullTelemetryReporter } from './Fakes';
import { TelemetryObserver } from '../../../src/observers/TelemetryObserver';
import { PlatformInformation } from '../../../src/platform';
import { PackageInstallation, InstallationFailure } from '../../../src/omnisharp/loggingEvents';
import { PackageError, Package } from '../../../src/packages';

suite('TelemetryReporterObserver', () => {
    suiteSetup(() => should());
    let platformInfo = new PlatformInformation("platform", "architecture");
    let name = "";
    let property = null;
    let measure = null;
    let observer = new TelemetryObserver(platformInfo, () => {
        return {
            ...getNullTelemetryReporter,
            sendTelemetryEvent: (eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }) => {
                name += eventName;
                property = properties;
                measure = measures;
            }
        };
    });

    setup(() => {
        name = "";
        property = null;
        measure = null;
    });

    test('PackageInstallation: AcquisitionStart is reported', () => {
        let event = new PackageInstallation("somePackage");
        observer.post(event);
        expect(name).to.be.not.empty;
    });

    test("InstallationFailure: Telemetry Props contains platform information, install stage and an event name", () => {
        let event = new InstallationFailure("someStage", "someError");
        observer.post(event);
        expect(property).to.have.property("platform.architecture", platformInfo.architecture);
        expect(property).to.have.property("platform.platform", platformInfo.platform);
        expect(property).to.have.property("installStage");
        expect(name).to.not.be.empty;
    });

    test(`InstallationFailure: Telemetry Props contains message and packageUrl if error is package error`, () => {
        let error = new PackageError("someError", <Package>{ "description": "foo", "url": "someurl" });
        let event = new InstallationFailure("someStage",error);
        observer.post(event);
        expect(property).to.have.property("error.message", error.message );
        expect(property).to.have.property("error.packageUrl", error.pkg.url);
    });

});
