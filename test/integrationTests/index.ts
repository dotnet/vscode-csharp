/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";

import { SubscribeToAllLoggers } from "../../src/logger";
import coverageWritingTestRunner from "../coverageWritingTestRunner";

//
// PLEASE DO NOT MODIFY / DELETE UNLESS YOU KNOW WHAT YOU ARE DOING
//
// This file is providing the test runner to use when running extension tests.
// By default the test runner in use is Mocha based.
//
// You can provide your own test runner if you want to override it by exporting
// a function run(testRoot: string, clb: (error:Error) => void) that the extension
// host can call to run the tests. The test runner is expected to use console.log
// to report the results back to the caller. When the tests are finished, return
// a possible error to the callback or null if none.

let testRunner = new coverageWritingTestRunner(require('vscode/lib/testrunner'));


// You can directly control Mocha options by uncommenting the following lines
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info

testRunner.configure({
    timeout: 60000,
    ui: 'tdd',      // the TDD UI is being used in extension.test.ts (suite, test, etc.)
    useColors: true // colored output from test results
});

if (process.env.CODE_EXTENSIONS_PATH && process.env.OSVC_SUITE) {
    let logDirPath = path.join(process.env.CODE_EXTENSIONS_PATH, "./.logs");

    if (!fs.existsSync(logDirPath)) {
        fs.mkdirSync(logDirPath);
    }

    let logFilePath = path.join(logDirPath, `${process.env.OSVC_SUITE}.log`);

    SubscribeToAllLoggers(message => fs.appendFileSync(logFilePath, message));
}

module.exports = testRunner;