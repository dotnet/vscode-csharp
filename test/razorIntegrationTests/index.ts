/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { runIntegrationTests } from '../runIntegrationTests';
import { jestIntegrationTestProjectName } from './jest.config';

export async function run() {
    process.env.RUNNING_INTEGRATION_TESTS = 'true';

    await runIntegrationTests(jestIntegrationTestProjectName);
}
