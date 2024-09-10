/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, test, expect, beforeEach } from '@jest/globals';
import { vscode } from '../../../../src/vscodeAdapter';

import { ErrorMessageObserver } from '../../../../src/omnisharp/observers/errorMessageObserver';
import { ZipError, EventWithMessage, IntegrityCheckFailure } from '../../../../src/shared/loggingEvents';
import { getFakeVsCode } from '../../../fakes';
import { DotNetTestDebugStartFailure, DotNetTestRunFailure } from '../../../../src/omnisharp/omnisharpLoggingEvents';

describe('ErrorMessageObserver', () => {
    const vscode: vscode = getFakeVsCode();
    let errorMessage: string | undefined;
    const observer = new ErrorMessageObserver(vscode);

    vscode.window.showErrorMessage = async (message: string, ..._: string[]) => {
        errorMessage = message;
        return Promise.resolve<string>('Done');
    };

    beforeEach(() => {
        errorMessage = undefined;
    });

    [
        new ZipError('This is an error'),
        new DotNetTestRunFailure('This is a failure message'),
        new DotNetTestDebugStartFailure('Start failure'),
    ].forEach((event: EventWithMessage) => {
        test(`${event.constructor.name}: Error message is shown`, () => {
            observer.post(event);
            expect(errorMessage).toContain(event.message);
        });
    });

    describe(`${IntegrityCheckFailure.name}`, () => {
        test('Package Description and url are logged when we are not retrying', () => {
            const description = 'someDescription';
            const url = 'someUrl';
            const event = new IntegrityCheckFailure(description, url, false);
            observer.post(event);
            expect(errorMessage).toContain(description);
            expect(errorMessage).toContain(url);
        });

        test('Nothing is shown if we are retrying', () => {
            const description = 'someDescription';
            const url = 'someUrl';
            const event = new IntegrityCheckFailure(description, url, true);
            observer.post(event);
            expect(errorMessage).toBe(undefined);
        });
    });
});
