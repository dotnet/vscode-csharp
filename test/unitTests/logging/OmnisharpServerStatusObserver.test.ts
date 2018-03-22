/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { should, expect } from 'chai';
import { OmnisharpServerStatusObserver } from '../../../src/observers/OmnisharpServerStatusObserver';

suite('OmnisharpServerStatusObserver', () => {
    suiteSetup(() => should());
    let output = '';
    setup(() => {
        output = ''; 
    });
    let observer = new OmnisharpServerStatusObserver((message, ...items) => {
        output += message;
        output += items;
        return { then: () => { }};
    }, (command, ...rest) => {
        
    });

    test('OmnisharpServerMsBuildProjectDiagnostics', () => {
        let event = getOmnisharpMSBuildProjectDiagnostics("someFile",
            [getMSBuildDiagnosticsMessage("warningFile", "", "", 0, 0, 0, 0)],
            []);
        observer.post(event);
    });
});