/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import { vscode } from '../../../src/vscodeAdapter';
import { getNullChannel, updateConfig, getVSCodeWithConfig } from '../../../test/unitTests/fakes';
import { OmnisharpChannelObserver } from '../../../src/observers/omnisharpChannelObserver';
import {
    OmnisharpFailure,
    ShowOmniSharpChannel,
    BaseEvent,
    OmnisharpRestart,
    OmnisharpServerOnStdErr,
} from '../../../src/omnisharp/loggingEvents';
import { Subject } from 'rxjs';

suite('OmnisharpChannelObserver', () => {
    let hasShown: boolean;
    let hasCleared: boolean;
    let preserveFocus: boolean | undefined;
    let vscode: vscode;
    const optionObservable = new Subject<void>();
    let observer: OmnisharpChannelObserver;

    setup(() => {
        hasShown = false;
        hasCleared = false;
        preserveFocus = false;
        vscode = getVSCodeWithConfig();
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

        updateConfig(vscode, 'csharp', 'showOmnisharpLogOnError', true);
        optionObservable.next();
    });

    [
        new OmnisharpFailure('errorMessage', new Error('error')),
        new ShowOmniSharpChannel(),
        new OmnisharpServerOnStdErr('std err'),
    ].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is shown and preserveFocus is set to true`, () => {
            expect(hasShown).to.be.false;
            observer.post(event);
            expect(hasShown).to.be.true;
            expect(preserveFocus).to.be.true;
        });
    });

    test(`OmnisharpServerOnStdErr: Channel is not shown when disabled in configuration`, () => {
        updateConfig(vscode, 'csharp', 'showOmnisharpLogOnError', false);
        optionObservable.next();

        expect(hasShown).to.be.false;
        observer.post(new OmnisharpServerOnStdErr('std err'));
        expect(hasShown).to.be.false;
        expect(preserveFocus).to.be.false;
    });

    [new OmnisharpRestart()].forEach((event: BaseEvent) => {
        test(`${event.constructor.name}: Channel is cleared`, () => {
            expect(hasCleared).to.be.false;
            observer.post(event);
            expect(hasCleared).to.be.true;
        });
    });
});
