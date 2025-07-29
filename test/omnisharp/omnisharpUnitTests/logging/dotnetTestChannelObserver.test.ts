/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { getNullChannel } from '../../../fakes';
import { BaseEvent } from '../../../../src/shared/loggingEvents';
import DotnetTestChannelObserver from '../../../../src/omnisharp/observers/dotnetTestChannelObserver';
import {
    DotNetTestDebugStart,
    DotNetTestRunFailure,
    DotNetTestRunStart,
    DotNetTestsInClassDebugStart,
    DotNetTestsInClassRunStart,
} from '../../../../src/omnisharp/omnisharpLoggingEvents';

describe('DotnetTestChannelObserver', () => {
    let hasShown: boolean;
    let preserveFocus: boolean;

    const observer = new DotnetTestChannelObserver({
        ...getNullChannel(),
        show: (preserve) => {
            hasShown = true;
            preserveFocus = preserve ?? false;
        },
    });

    beforeEach(() => {
        hasShown = false;
    });

    [
        new DotNetTestRunStart('foo'),
        new DotNetTestRunFailure('some failure'),
        new DotNetTestsInClassRunStart('someclass'),
        new DotNetTestDebugStart('foo'),
        new DotNetTestsInClassDebugStart('someclass'),
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is shown and preserve focus is set to true`, () => {
            expect(hasShown).toBe(false);
            observer.post(event);
            expect(hasShown).toBe(true);
            expect(preserveFocus).toBe(true);
        });
    });
});
