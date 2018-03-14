/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { CsharpChannelObserver } from '../../../src/observers/CsharpChannelObserver';
import { InstallationFailure, PackageInstallation, DebuggerNotInstalledFailure, DebuggerPrerequisiteFailure, ProjectJsonDeprecatedWarning, BaseEvent } from '../../../src/omnisharp/loggingEvents';

suite("CsharpChannelObserver", () => {
    suiteSetup(() => should());
    [
        new InstallationFailure("someStage", "someError"),
        new PackageInstallation("somePackage"),
        new DebuggerNotInstalledFailure(),
        new DebuggerPrerequisiteFailure("some failure"),
        new ProjectJsonDeprecatedWarning()
    ].forEach((event: BaseEvent) => {
        test(`Shows the channel for ${event.constructor.name}`, () => {
            let hasShown = false;

            let observer = new CsharpChannelObserver({
                ...getNullChannel(),
                show: () => { hasShown = true; }
            });

            observer.post(event);
            expect(hasShown).to.be.true;
        });
    });
});
