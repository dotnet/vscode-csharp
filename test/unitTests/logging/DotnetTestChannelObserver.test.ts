/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { BaseEvent, DotNetTestsInClassDebugStart, DotNetTestRunStart, DotNetTestRunFailure, DotNetTestsInClassRunStart, DotNetTestDebugStart } from '../../../src/omnisharp/loggingEvents';
import DotnetTestChannelObserver from '../../../src/observers/DotnetTestChannelObserver';

suite("DotnetTestChannelObserver", () => {
    let hasShown: boolean;
    let preserveFocus: boolean;

    let observer = new DotnetTestChannelObserver({
        ...getNullChannel(),
        show: (preserve) => {
            hasShown = true;
            preserveFocus = preserve;
        }
    });

    setup(() => {
        hasShown = false;
    });

    [
        new DotNetTestRunStart("foo"),
        new DotNetTestRunFailure("some failure"),
        new DotNetTestsInClassRunStart("someclass"),
        new DotNetTestDebugStart("foo"),
        new DotNetTestsInClassDebugStart("someclass")
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is shown and preserve focus is set to true`, () => {
            expect(hasShown).to.be.false;
            observer.post(event);
            expect(hasShown).to.be.true;
            expect(preserveFocus).to.be.true;
        });
    });
});
