/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { use as chaiUse, expect, should } from 'chai';
import { vscode } from '../../../src/vscodeAdapter';
import { getFakeVsCode } from '../testAssets/Fakes';
import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/timeout';
import { ErrorMessageObserver } from '../../../src/observers/ErrorMessageObserver';
import { ZipError } from '../../../src/omnisharp/loggingEvents';

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

    test('ZipError: Error message is shown', () => {
        let event = new ZipError("This is an error");
            observer.post(event);
            expect(errorMessage).to.be.equal("This is an error");
    });   
});