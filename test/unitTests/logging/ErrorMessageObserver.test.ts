/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { use as chaiUse, expect, should } from 'chai';
import { vscode } from '../../../src/vscodeAdapter';
import { getFakeVsCode } from '../testAssets/Fakes';


import { ErrorMessageObserver } from '../../../src/observers/ErrorMessageObserver';
import { ZipError, DotNetTestRunFailure, DotNetTestDebugStartFailure, EventWithMessage, IntegrityCheckFailure } from '../../../src/omnisharp/loggingEvents';

chaiUse(require('chai-as-promised'));
chaiUse(require('chai-string'));

suite("ErrorMessageObserver", () => {
    suiteSetup(() => should());

    let vscode: vscode = getFakeVsCode();
    let errorMessage: string;
    let observer = new ErrorMessageObserver(vscode);

    vscode.window.showErrorMessage = async (message: string, ...items: string[]) => {
        errorMessage = message;
        return Promise.resolve<string>("Done");
    };

    setup(() => {
        errorMessage = undefined;
    });

    [
        new ZipError("This is an error"),
        new DotNetTestRunFailure("This is a failure message"),
        new DotNetTestDebugStartFailure("Start failure")
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Error message is shown`, () => {
            observer.post(event);
            expect(errorMessage).to.be.contain(event.message);
        });
    });

    suite(`${IntegrityCheckFailure.name}`, () => {
        test("Package Description and url are logged when we are not retrying", () => {
            let description = 'someDescription';
            let url = 'someUrl';
            let event = new IntegrityCheckFailure(description, url, false);
            observer.post(event);
            expect(errorMessage).to.contain(description);
            expect(errorMessage).to.contain(url);
        });

        test("Nothing is shown if we are retrying", () => {
            let description = 'someDescription';
            let url = 'someUrl';
            let event = new IntegrityCheckFailure(description, url, true);
            observer.post(event);
            expect(errorMessage).to.be.undefined;
        });
    });
});