/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { DotNetChannelObserver } from "../../../src/observers/DotnetChannelObserver";
import { getNullChannel } from './Fakes';
import { CommandDotNetRestoreStart, BaseEvent } from '../../../src/omnisharp/loggingEvents';

suite("DotnetChannelObserver", () => {
    suiteSetup(() => should());

    [
        new CommandDotNetRestoreStart()
    ].forEach((event: BaseEvent) => {
        test(`Clears the channel for ${event.constructor.name}`, () => {
            let hasCleared = false;
            let observer = new DotNetChannelObserver({
                ...getNullChannel(),
                clear: () => { hasCleared = true; }
            });

            observer.post(event);
            expect(hasCleared).to.be.true;
        });
    });

    [
        new CommandDotNetRestoreStart()
    ].forEach((event: BaseEvent) => {
        test(`Shows the channel for ${event.constructor.name}`, () => {
            let hasShown = false;
            let observer = new DotNetChannelObserver({
                ...getNullChannel(),
                show: () => { hasShown = true; }
            });

            observer.post(event);
            expect(hasShown).to.be.true;
        });
    });
});
