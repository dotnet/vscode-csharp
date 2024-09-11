/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { getNullChannel, getWorkspaceConfiguration } from '../../../fakes';
import { OmnisharpChannelObserver } from '../../../../src/omnisharp/observers/omnisharpChannelObserver';
import { BaseEvent } from '../../../../src/shared/loggingEvents';
import { Subject } from 'rxjs';
import {
    OmnisharpFailure,
    OmnisharpRestart,
    OmnisharpServerOnStdErr,
    ShowOmniSharpChannel,
} from '../../../../src/omnisharp/omnisharpLoggingEvents';

describe('OmnisharpChannelObserver', () => {
    let hasShown: boolean;
    let hasCleared: boolean;
    let preserveFocus: boolean | undefined;
    const optionObservable = new Subject<void>();
    let observer: OmnisharpChannelObserver;

    beforeEach(() => {
        hasShown = false;
        hasCleared = false;
        preserveFocus = false;
        observer = new OmnisharpChannelObserver({
            ...getNullChannel(),
            show: (preserve) => {
                hasShown = true;
                preserveFocus = preserve;
            },
            clear: () => {
                hasCleared = true;
            },
        });

        jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(getWorkspaceConfiguration());

        vscode.workspace.getConfiguration().update('csharp.showOmnisharpLogOnError', true);
        optionObservable.next();
    });

    [
        new OmnisharpFailure('errorMessage', new Error('error')),
        new ShowOmniSharpChannel(),
        new OmnisharpServerOnStdErr('std err'),
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is shown and preserveFocus is set to true`, () => {
            expect(hasShown).toEqual(false);
            observer.post(event);
            expect(hasShown).toEqual(true);
            expect(preserveFocus).toEqual(true);
        });
    });

    test(`OmnisharpServerOnStdErr: Channel is not shown when disabled in configuration`, () => {
        vscode.workspace.getConfiguration().update('csharp.showOmnisharpLogOnError', false);
        optionObservable.next();

        expect(hasShown).toEqual(false);
        observer.post(new OmnisharpServerOnStdErr('std err'));
        expect(hasShown).toEqual(false);
        expect(preserveFocus).toEqual(false);
    });

    [new OmnisharpRestart()].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is cleared`, () => {
            expect(hasCleared).toEqual(false);
            observer.post(event);
            expect(hasCleared).toEqual(true);
        });
    });
});
