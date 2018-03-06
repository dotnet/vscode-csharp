/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { Message, MessageType } from '../../../src/omnisharp/messageType';
import { getNullChannel } from './Fakes';
import * as CreateMessage from './CreateMessage';
import { CsharpChannelObserver } from '../../../src/omnisharp/observers/CsharpChannelObserver';

suite("CsharpChannelObserver", () => {
    suiteSetup(() => should());
    [
        CreateMessage.InstallationFailure("someStage", "someError"),
        CreateMessage.PackageInstallation("somePackage"),
        CreateMessage.DebuggerNotInstalledFailure(),
        CreateMessage.DebuggerPreRequisiteFailure("some failure"),
        CreateMessage.ProjectJsonDeprecatedWarning()
    ].forEach((message: Message) => {
        test(`Shows the channel for ${CreateMessage.DisplayMessageType(message)}`, () => {
            let hasShown = false;

            let observer = new CsharpChannelObserver(() => ({
                ...getNullChannel(),
                show: () => { hasShown = true; }
            }));

            observer.onNext(message);
            expect(hasShown).to.be.true;
        });
    });
});
