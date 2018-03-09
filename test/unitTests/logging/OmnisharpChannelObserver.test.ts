/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { OmnisharpChannelObserver } from '../../../src/observers/OmnisharpChannelObserver';
import { BaseEvent, OmnisharpFailure } from '../../../src/omnisharp/loggingEvents';

suite("OmnisharpChannelObserver", () => {
    suiteSetup(() => should());
    [
        new OmnisharpFailure("errorMessage", new Error("error")),
    ].forEach((event: BaseEvent) => {
        test(`Shows the channel for ${event.constructor.name}`, () => {
            let hasShown = false;
            let observer = new OmnisharpChannelObserver({
                ...getNullChannel(),
                show: () => { hasShown = true; }
            });

            observer.post(event);
            expect(hasShown).to.be.true;
        });
    });
});