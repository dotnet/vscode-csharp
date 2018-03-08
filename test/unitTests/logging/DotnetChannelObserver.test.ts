/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { DotNetChannelObserver } from "../../../src/observers/DotnetChannelObserver";
import { MessageType, Message, ActionWithMessage } from '../../../src/omnisharp/messageType';
import { getNullChannel } from './Fakes';
import * as CreateMessage from './CreateMessage';

suite("DotnetChannelObserver", () => {
    suiteSetup(() => should());

    [
        CreateMessage.CommandDotNetRestoreStart()
    ].forEach((message: Message) => {
        test(`Clears the channel for ${CreateMessage.DisplayMessageType(message)}`, () => {
            let hasCleared = false;
            let observer = new DotNetChannelObserver({
                ...getNullChannel(),
                clear: () => { hasCleared = true; }
            });

            observer.onNext(message);
            expect(hasCleared).to.be.true;
        });
    });

    [
        CreateMessage.CommandDotNetRestoreStart()
    ].forEach((message: Message) => {
        test(`Shows the channel for ${CreateMessage.DisplayMessageType(message)}`, () => {
            let hasShown = false;
            let observer = new DotNetChannelObserver({
                ...getNullChannel(),
                show: () => { hasShown = true; }
            });

            observer.onNext(message);
            expect(hasShown).to.be.true;
        });
    });
});
