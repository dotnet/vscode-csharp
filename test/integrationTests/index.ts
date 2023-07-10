/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as testRunner from '../testRunner';

export async function run() {
    process.env.RUNNING_INTEGRATION_TESTS = 'true';

    return testRunner.run(path.resolve(__dirname, '.'), {
        timeout: 120000, // this seems to timing out often in our pipeline
        ui: 'tdd', // the TDD UI is being used in extension.test.ts (suite, test, etc.)
        useColors: true, // colored output from test results
    });
}
