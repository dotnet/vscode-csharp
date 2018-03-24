/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rx from 'rx';

import { MessageItemWithCommand, OmnisharpServerStatusObserver } from '../../../src/observers/OmnisharpServerStatusObserver';
import { expect, should } from 'chai';
import { getMSBuildDiagnosticsMessage, getOmnisharpMSBuildProjectDiagnostics } from './Fakes';

import { getFakeVsCode } from './Fakes';
import { resolve } from 'path';
import { vscode } from '../../../src/vscodeAdapter';

suite('OmnisharpServerStatusObserver', () => {
    let warningMessage;
    let invokedCommand;
    let scheduler: rx.HistoricalScheduler;
    let observer: OmnisharpServerStatusObserver;
    let vscode: vscode = getFakeVsCode();

    vscode.window.showWarningMessage =  <T>(message, ...items) => {
        warningMessage = message;
        
        return undefined;
    };

    vscode.commands.executeCommand = <T>(command, ...rest) => {
        invokedCommand = command;
        return undefined;
    };
    
    suiteSetup(() => should());
    
    setup(() => {
        scheduler = new rx.HistoricalScheduler(0, (x, y) => {
            return x > y ? 1 : -1;
        });
        observer = new OmnisharpServerStatusObserver(vscode);
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors array is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnostics("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            []);
        observer.post(event);
        expect(output).to.be.empty;
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors array is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnostics("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
            [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]);
        observer.post(event);
        scheduler.advanceBy(1500);
        console.log(output);
        expect(output).to.contain("Show Output");
        expect(output).to.contain("o.showOutput");
        expect(output).to.contain("show warning message called");
        expect(output).to.contain("execute command called");
    });
});