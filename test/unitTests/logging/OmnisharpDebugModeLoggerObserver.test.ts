/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { OmnisharpServerVerboseMessage, EventWithMessage } from '../../../src/omnisharp/loggingEvents';
import { OmnisharpDebugModeLoggerObserver } from '../../../src/observers/OmnisharpDebugModeLoggerObserver';

suite("OmnisharpLoggerObserver", () => {
    suiteSetup(() => should());
    [
        new OmnisharpServerVerboseMessage("server verbose message")
    ].forEach((event: EventWithMessage) => {
        test(`Shows the channel for ${event.constructor.name}`, () => {
            let logOutput = "";
            let observer = new OmnisharpDebugModeLoggerObserver({
                ...getNullChannel(),
                append: (text: string) => { logOutput += text; },
            });

            observer.post(event);
            expect(logOutput).to.contain(event.message);
        });
    });
});