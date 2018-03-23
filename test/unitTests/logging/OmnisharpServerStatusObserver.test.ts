/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import * as rx from 'rx';
import { OmnisharpServerStatusObserver, ShowWarningMessage, MessageItemWithCommand, ExecuteCommand } from '../../../src/observers/OmnisharpServerStatusObserver';
import { resolve } from 'path';
import { getOmnisharpMSBuildProjectDiagnostics, getMSBuildDiagnosticsMessage } from './Fakes';
import * as vscode from '../../../src/vscodeAdapter';

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    let output = '';
    let scheduler: rx.HistoricalScheduler;
    let observer: OmnisharpServerStatusObserver;

    let warningFunction : ShowWarningMessage<MessageItemWithCommand> = (message, ...items) => {
        output += "show warning message called";
        output += message;
        items.forEach(element => {
            output += element.title;
            output += element.command;
        });

        let testMessage : MessageItemWithCommand = {
            title: "myTitle",
            command: "myCommand"
        };
        
        return Promise.resolve(testMessage);
    };    

    let executeCommand: ExecuteCommand<string> = (command, ...rest) => {
        output += "execute command called";
        output += command;
        return Promise.resolve("execute command resolved");
    };
    
    setup(() => {
        output = '';
        scheduler = new rx.HistoricalScheduler(0, (x, y) => {
            return x > y ? 1 : -1;
        });
        observer = new OmnisharpServerStatusObserver(warningFunction, executeCommand, scheduler);
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