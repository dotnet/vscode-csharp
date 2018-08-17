/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { DotnetLoggerObserver } from '../../../src/observers/DotnetLoggerObserver';
import { CommandDotNetRestoreProgress, CommandDotNetRestoreSucceeded, CommandDotNetRestoreFailed, EventWithMessage } from '../../../src/omnisharp/loggingEvents';

suite("DotnetLoggerObserver", () => {
    suiteSetup(() => should());

    [
        new CommandDotNetRestoreProgress("Some message"),
        new CommandDotNetRestoreSucceeded("Some message"),
        new CommandDotNetRestoreFailed("Some message")
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Message is logged`, () => {
            let appendedMessage = "";
            let observer = new DotnetLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { appendedMessage += text; },
            });

            observer.post(event);
            expect(appendedMessage).to.contain(event.message);
        });
    });
});
