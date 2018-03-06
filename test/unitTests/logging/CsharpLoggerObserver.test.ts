/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { MessageType, Message } from '../../../src/omnisharp/messageType';
import { getNullLogger } from './Fakes';
import * as CreateMessage from './CreateMessage';
import { CsharpLoggerObserver } from '../../../src/omnisharp/observers/CsharpLoggerObserver';

suite("CsharpLoggerObserver", () => {
    suiteSetup(() => should());

    [
        {
            events: [],
            expected: ""
        },
        {
            events: [CreateMessage.DownloadStart("Started")],
            expected: "Started"
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(10), CreateMessage.DownloadProgress(50), CreateMessage.DownloadProgress(100)],
            expected: "Started...................."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(10), CreateMessage.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(50), CreateMessage.DownloadProgress(50), CreateMessage.DownloadProgress(50)],
            expected: "Started.........."
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(100), CreateMessage.DownloadSuccess("Done")],
            expected: "Started....................Done\n"
        },
        {
            events: [CreateMessage.DownloadStart("Started"), CreateMessage.DownloadProgress(50), CreateMessage.DownloadFailure("Failed")],
            expected: "Started..........Failed\n"
        },
    ].forEach((setup) => {
        test(`Prints the download status to the logger as ${setup.expected}`, () => {
            let logOutput = "";

            let observer = new CsharpLoggerObserver(() => ({
                ...getNullLogger(),
                appendLine: (text?: string) => { logOutput += `${text}\n`; },
                append: (text?: string) => { logOutput += text; }
            }));

            setup.events.forEach((message: Message) => observer.onNext(message));

            expect(logOutput).to.be.equal(setup.expected);
        });
    });
});
