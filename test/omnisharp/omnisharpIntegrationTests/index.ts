/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { runIntegrationTests } from '../../runIntegrationTests';
import { jestIntegrationTestProjectName } from './jest.config';

export async function run() {
    process.env.RUNNING_INTEGRATION_TESTS = 'true';

    const results = await runIntegrationTests(jestIntegrationTestProjectName);

    // Explicitly exit the process - VSCode likes to write a bunch of cancellation errors to the console after this
    // which make it look like the tests always fail.  We're done with the tests at this point, so just exit.
    process.exit(results.success ? 0 : 1);
}
