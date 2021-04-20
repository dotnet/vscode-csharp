/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

import { SubscribeToAllLoggers } from "../../src/logger";

function setupLogging() {
    if (process.env.CODE_EXTENSIONS_PATH && process.env.OSVC_SUITE) {
        let logDirPath = path.join(process.env.CODE_EXTENSIONS_PATH, "./.logs");

        if (!fs.existsSync(logDirPath)) {
            fs.mkdirSync(logDirPath);
        }

        let logFilePath = path.join(logDirPath, `${process.env.OSVC_SUITE}.log`);

        SubscribeToAllLoggers(message => fs.appendFileSync(logFilePath, message));
    }
}

export async function run(): Promise<void> {
    setupLogging();

    // Create the mocha test
    const mocha = new Mocha({
        timeout: 60000,
        ui: 'tdd',      // the TDD UI is being used in extension.test.ts (suite, test, etc.)
        useColors: true // colored output from test results
    });

    const testsRoot = path.resolve(__dirname, '.');

    return new Promise((c, e) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err);
            }

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                e(err);
            }
        });
    });
}
