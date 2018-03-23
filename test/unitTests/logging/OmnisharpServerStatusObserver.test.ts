/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { OmnisharpServerStatusObserver } from '../../../src/observers/OmnisharpServerStatusObserver';
import { resolve } from 'path';
import { getOmnisharpMSBuildProjectDiagnostics, getMSBuildDiagnosticsMessage } from './Fakes';

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    let output = '';
    setup(() => {
        output = ''; 
    });
    
    let warningFunction = (message, ...items) => {
        output += message;
        output += items;
        return Promise.resolve("hello");
    };

    let executeCommand = <T>(command, ...rest) => {
        return new Promise<T>((resolve, reject) => { resolve(); });
    };

    let clearTimeOut = (timeoutid: NodeJS.Timer) => {
        output += timeoutid;
    };

    let setTimeout = (callback: (...args: any[]) => void, ms: number, ...args: any[]) => {
        callback();
        let x: NodeJS.Timer;
        return x;
    };

    let observer = new OmnisharpServerStatusObserver(warningFunction, executeCommand, clearTimeOut, setTimeout);

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors arry is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnostics("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            []);
        observer.post(event);
        expect(output).to.be.empty;
    });

    test('OmnisharpServerMsBuildProjectDiagnostics: No action is taken if the errors arry is empty', () => {
        let event = getOmnisharpMSBuildProjectDiagnostics("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 1, 2, 3, 4)],
            [getMSBuildDiagnosticsMessage("errorFile", "", "", 5, 6, 7, 8)]);
        observer.post(event);
        expect(output).to.be.empty;
    });
});