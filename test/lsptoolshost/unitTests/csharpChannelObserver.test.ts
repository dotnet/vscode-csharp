/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import { getNullChannel } from '../../fakes';
import { CsharpChannelObserver } from '../../../src/shared/observers/csharpChannelObserver';
import {
    InstallationFailure,
    BaseEvent,
    PackageInstallStart,
    IntegrityCheckFailure,
    DebuggerNotInstalledFailure,
    DebuggerPrerequisiteFailure,
} from '../../../src/shared/loggingEvents';

describe('CsharpChannelObserver', () => {
    [
        new InstallationFailure('someStage', 'someError'),
        new DebuggerNotInstalledFailure(),
        new DebuggerPrerequisiteFailure('some failure'),
        new IntegrityCheckFailure('', '', true),
        new PackageInstallStart(),
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is shown and preserve focus is set to true`, () => {
            let hasShown = false;
            let preserveFocus = false;
            const observer = new CsharpChannelObserver({
                ...getNullChannel(),
                show: (preserve) => {
                    hasShown = true;
                    preserveFocus = preserve ?? false;
                },
            });

            observer.post(event);
            expect(hasShown).toBe(true);
            expect(preserveFocus).toBe(true);
        });
    });
});
