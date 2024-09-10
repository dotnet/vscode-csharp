/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DotNetChannelObserver } from '../../../../src/omnisharp/observers/dotnetChannelObserver';
import { getNullChannel } from '../../../fakes';
import { CommandDotNetRestoreStart } from '../../../../src/omnisharp/omnisharpLoggingEvents';

describe('DotnetChannelObserver', () => {
    let hasShown: boolean;
    let hasCleared: boolean;

    const observer = new DotNetChannelObserver({
        ...getNullChannel(),
        clear: () => {
            hasCleared = true;
        },
        show: () => {
            hasShown = true;
        },
    });

    beforeEach(() => {
        hasShown = false;
        hasCleared = false;
    });

    test(`CommandDotNetRestoreStart : Clears and shows the channel`, () => {
        const event = new CommandDotNetRestoreStart();
        observer.post(event);
        expect(hasCleared).toBe(true);
        expect(hasShown).toBe(true);
    });
});
