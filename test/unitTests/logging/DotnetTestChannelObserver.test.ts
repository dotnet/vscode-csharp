/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { BaseEvent, DotnetTestsInClassDebugStart, DotnetTestRunStart, DotnetTestRunFailure, DotnetTestsInClassRunStart, DotnetTestDebugStart } from '../../../src/omnisharp/loggingEvents';
import DotnetTestChannelObserver from '../../../src/observers/DotnetTestChannelObserver';

suite("DotnetTestChannelObserver", () => {
    let hasShown: boolean;

    let observer = new DotnetTestChannelObserver({
        ...getNullChannel(),
        show: () => { hasShown = true; }
    });

    setup(() => {
        hasShown = false;
    });

    [
        new DotnetTestRunStart("foo"),
        new DotnetTestRunFailure("some failure"),
        new DotnetTestsInClassRunStart(),
        new DotnetTestDebugStart("foo"),
        new DotnetTestsInClassDebugStart()
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is shown`, () => {
            expect(hasShown).to.be.false;
            observer.post(event);
            expect(hasShown).to.be.true;
        });
    });
});
