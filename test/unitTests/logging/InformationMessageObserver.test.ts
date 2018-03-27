/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as rx from 'rx';
import { InformationMessageObserver } from '../../../src/observers/InformationMessageObserver';
import { expect, should } from 'chai';
import { vscode } from '../../../src/vscodeAdapter';
import { getFakeVsCode } from './Fakes';

suite("InformationMessageObserver", () => {
    suiteSetup(() => should()); 

    let vscode: vscode = getFakeVsCode();
    let observer = new InformationMessageObserver(vscode);

});