/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { DotNetChannelObserver } from "../../../src/observers/dotnetChannelObserver";
import { getNullChannel } from '../testAssets/fakes';
import { CommandDotNetRestoreStart } from '../../../src/omnisharp/loggingEvents';

suite("DotnetChannelObserver", () => {
    suiteSetup(() => should());
    let hasShown: boolean;
    let hasCleared: boolean;

    const observer = new DotNetChannelObserver({
        ...getNullChannel(),
        clear: () => { hasCleared = true; },
        show: () => { hasShown = true; }
    });

    setup(() => {
        hasShown = false;
        hasCleared = false;
    });

    test(`CommandDotNetRestoreStart : Clears and shows the channel`, () => {
        const event = new CommandDotNetRestoreStart();
        observer.post(event);
        expect(hasCleared).to.be.true;
        expect(hasShown).to.be.true;
    });
});
