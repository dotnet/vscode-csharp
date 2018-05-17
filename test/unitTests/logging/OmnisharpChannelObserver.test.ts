/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { OmnisharpChannelObserver } from '../../../src/observers/OmnisharpChannelObserver';
import { OmnisharpFailure, ShowOmniSharpChannel, BaseEvent, OmnisharpRestart } from '../../../src/omnisharp/loggingEvents';

suite("OmnisharpChannelObserver", () => {

    let hasShown: boolean;
    let hasCleared: boolean;
    let observer: OmnisharpChannelObserver;

    setup(() => {
        hasShown = false;
        hasCleared = false;
        observer = new OmnisharpChannelObserver({
            ...getNullChannel(),
            show: () => { hasShown = true; },
            clear: () => { hasCleared = true; }
        });
    });

    [
        new OmnisharpFailure("errorMessage", new Error("error")),
        new ShowOmniSharpChannel()
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is shown`, () => {
            expect(hasShown).to.be.false;
            observer.post(event);
            expect(hasShown).to.be.true;
        });
    });

    [
        new OmnisharpRestart()
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is cleared`, () => {
            expect(hasCleared).to.be.false;
            observer.post(event);
            expect(hasCleared).to.be.true;
        });
    });
});