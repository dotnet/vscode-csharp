/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { Message, MessageType } from '../../../src/omnisharp/messageType';
import { getNullChannel } from './Fakes';
import * as CreateMessage from './CreateMessage';
import { OmnisharpChannelObserver } from '../../../src/observers/OmnisharpChannelObserver';

suite("OmnisharpChannelObserver", () => {
    suiteSetup(() => should());
    [
        CreateMessage.OmnisharpFailure("errorMessage", "error"),
    ].forEach((message: Message) => {
        test(`Shows the channel for ${CreateMessage.DisplayMessageType(message)}`, () => {
            let hasShown = false;
            let observer = new OmnisharpChannelObserver({
                ...getNullChannel(),
                show: () => { hasShown = true; }
            });

            observer.onNext(message);
            expect(hasShown).to.be.true;
        });
    });

    [
        CreateMessage.OmnisharpServerMsBuildProjectDiagnostics("someFile",
            [{ FileName: "warningFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }],
            [{ FileName: "errorFile", LogLevel: "", Text: "", StartLine: 0, EndLine: 0, StartColumn: 0, EndColumn: 0 }])
    ].forEach((message: Message) => {
        test(`Shows the channel for ${CreateMessage.DisplayMessageType(message)}`, () => {
            let hasShown = false;
            let observer = new OmnisharpChannelObserver({
                ...getNullChannel(),
                show: () => { hasShown = true; }
            });

            observer.onNext(message);
            expect(hasShown).to.be.true;
        });
    });
});