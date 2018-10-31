/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { use, should, expect } from 'chai';
import { getNullChannel } from '../testAssets/Fakes';
import { RazorLoggerObserver } from '../../../src/observers/RazorLoggerObserver';
import { RazorPluginPathSpecified, RazorPluginPathDoesNotExist, RazorDevModeActive } from '../../../src/omnisharp/loggingEvents';

use(require("chai-string"));

suite("RazorLoggerObserver", () => {
    suiteSetup(() => should());
    let logOutput = "";
    let observer = new RazorLoggerObserver({
        ...getNullChannel(),
        append: (text: string) => { logOutput += text; },
    });

    setup(() => {
        logOutput = "";
    });

    test(`RazorPluginPathSpecified: Path is logged`, () => {
        let event = new RazorPluginPathSpecified("somePath");
        observer.post(event);
        expect(logOutput).to.contain(event.path);
    });

    test(`RazorPluginPathDoesNotExist: Path is logged`, () => {
        let event = new RazorPluginPathDoesNotExist("somePath");
        observer.post(event);
        expect(logOutput).to.contain(event.path);
    });

    test(`RazorDevModeActive: Logs dev mode active`, () => {
        let event = new RazorDevModeActive();
        observer.post(event);
        expect(logOutput).to.contain('Razor dev mode active');
    });
});
