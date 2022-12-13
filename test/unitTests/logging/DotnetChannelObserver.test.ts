/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { DotNetChannelObserver } from "../../../src/observers/DotnetChannelObserver";
import { getNullChannel, getVSCodeWithConfig, updateConfig } from '../testAssets/Fakes';
import { CommandDotNetRestoreStart } from '../../../src/omnisharp/loggingEvents';

suite("DotnetChannelObserver", () => {
    suiteSetup(() => should());
    let hasShown: boolean;
    let hasCleared: boolean;
    let vscode = getVSCodeWithConfig();
    let observer = new DotNetChannelObserver(
        {
            ...getNullChannel(),
            clear: () => { hasCleared = true; },
            show: () => { hasShown = true; }
        },
        vscode
    );
    updateConfig(vscode, "csharp", "showOmnisharpLogOnError", true);

    setup(() => {
        hasShown = false;
        hasCleared = false;
    });

    test(`CommandDotNetRestoreStart : Clears and shows the channel`, () => {
        let event = new CommandDotNetRestoreStart();
        observer.post(event);
        expect(hasCleared).to.be.true;
        expect(hasShown).to.be.true;
    });
});
