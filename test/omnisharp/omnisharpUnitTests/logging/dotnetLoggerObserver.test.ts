/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect } from '@jest/globals';
import { getNullChannel } from '../../../fakes.js';
import { DotnetLoggerObserver } from '../../../../src/omnisharp/observers/dotnetLoggerObserver.js';
import { EventWithMessage } from '../../../../src/shared/loggingEvents.js';
import {
    CommandDotNetRestoreFailed,
    CommandDotNetRestoreProgress,
    CommandDotNetRestoreSucceeded,
} from '../../../../src/omnisharp/omnisharpLoggingEvents.js';

describe('DotnetLoggerObserver', () => {
    [
        new CommandDotNetRestoreProgress('Some message'),
        new CommandDotNetRestoreSucceeded('Some message'),
        new CommandDotNetRestoreFailed('Some message'),
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Message is logged`, () => {
            let appendedMessage = '';
            const observer = new DotnetLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => {
                    appendedMessage += text;
                },
            });

            observer.post(event);
            expect(appendedMessage).toContain(event.message);
        });
    });
});
