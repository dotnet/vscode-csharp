/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob-promise';
import * as fs from 'fs';
import { SubscribeToAllLoggers } from "../src/logger";

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implementt he method statically
const tty = require('tty');
if (!tty.getWindowSize) {
    tty.getWindowSize = function () { return [80, 75]; };
}

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

export async function run(testsRoot: string, options?: Mocha.MochaOptions) {
    options ??= {
        ui: 'tdd',
        useColors: true
    };

    const mocha = new Mocha(options);

    setupLogging();

    // Enable source map support
    require('source-map-support').install();

    // Glob test files
    const files = await glob('**/**.test.js', { cwd: testsRoot });

    // Fill into Mocha
    files.forEach(file => mocha.addFile(path.join(testsRoot, file)));

    return new Promise<number>((resolve) => {
        mocha.run(resolve);
    }).then(failures => {
        if (failures > 0) {
            throw new Error(`${failures} tests failed.`);
        }
    });
}
