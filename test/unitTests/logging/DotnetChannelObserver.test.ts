/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { DotNetChannelObserver } from "../../../src/omnisharp/observers/DotnetChannelObserver";
import { MessageType, Message } from '../../../src/omnisharp/messageType';
import { DotnetInfo } from '../../../src/coreclr-debug/util';
import getNullChannel from './NullChannel';
import * as CreateMessage from './CreateMessage';

suite("DotnetChannelObserver", () => {
    suiteSetup(() => should());

    [
        CreateMessage.CommandDotNetRestoreStart()
    ].forEach((message: Message) => {
        test(`Clears the channel for ${message.type}`, () => {
            let hasCleared = false;

            let observer = new DotNetChannelObserver(() => ({
                    ...getNullChannel(),
                    clear: () => { hasCleared = true; }
            }));

            observer.onNext(message);

            expect(hasCleared).to.be.true;
        });
    });
});
