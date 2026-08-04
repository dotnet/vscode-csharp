/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { fileURLToPath } from 'url';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(currentDirectory, '../../');

        // The path to the extension test runner script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(currentDirectory, './omnisharpFeatureTests/index');

        // Download VS Code, unzip it and run the integration test
        const exitCode = await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: ['-n', '--verbose'],
        });

        process.exit(exitCode);
    } catch (err) {
        console.error(err);
        console.error('Failed to run tests');
        process.exit(1);
    }
}

// top level async not supported in our version of ts/modules
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
