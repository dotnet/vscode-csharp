/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { should, expect } from 'chai';
import { getNullChannel } from './Fakes';
import { OmnisharpChannelObserver } from '../../../src/observers/OmnisharpChannelObserver';
import { BaseEvent, OmnisharpFailure, CommandShowOutput } from '../../../src/omnisharp/loggingEvents';
import * as vscode from '../../../src/vscodeAdapter';
import { ViewColumn } from 'vscode';

suite("OmnisharpChannelObserver", () => {
    suiteSetup(() => should());
    test(`OmnisharpFailure: Shows the channel`, () => {
        let event = new OmnisharpFailure("errorMessage", new Error("error"));
        let hasShown = false;
        let observer = new OmnisharpChannelObserver({
            ...getNullChannel(),
            show: () => { hasShown = true; }
        });

        observer.post(event);
        expect(hasShown).to.be.true;
    });

    test('CommandShowOutput: Shows the channel', () => {
        let event = new CommandShowOutput();
        let testColumn: vscode.ViewColumn;
        let observer = new OmnisharpChannelObserver({
            ...getNullChannel(),
            show: (column?: ViewColumn, preserveFocus?: boolean) => { testColumn = column;}
        });

        observer.post(event);
        expect(testColumn).to.be.equal(vscode.ViewColumn.Three);
    });
});