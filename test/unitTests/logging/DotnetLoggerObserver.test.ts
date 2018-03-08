/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { MessageType, Message, ActionWithMessage } from '../../../src/omnisharp/messageType';
import { getNullChannel } from './Fakes';
import * as CreateMessage from './CreateMessage';
import { DotnetLoggerObserver } from '../../../src/observers/DotnetLoggerObserver';

suite("DotnetLoggerObserver", () => {
    suiteSetup(() => should());

    [
        CreateMessage.CommandDotNetRestoreProgress("Some message"),
        CreateMessage.CommandDotNetRestoreSucceeded("Some message"),
        CreateMessage.CommandDotNetRestoreFailed("Some message")
    ].forEach((message: ActionWithMessage) => {
        test(`Appends the text into the channel for ${CreateMessage.DisplayMessageType(message)}`, () => {
            let appendedMessage = "";
            let observer = new DotnetLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { appendedMessage += text; },
            });

            observer.onNext(message);
            expect(appendedMessage).to.contain(message.message);
        });
    });
});
