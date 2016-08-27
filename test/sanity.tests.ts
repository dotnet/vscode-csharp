/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as myExtension from '../src/main';

suite("Sanity Tests", () => {
    test("Boolean checks", () => {
        assert.equal(true, true, "true is not true");
        assert.notEqual(true, false, "true is false");
        assert.equal(false, false, "false is not false");
        assert.notEqual(false, true, "false is true");
    });
});