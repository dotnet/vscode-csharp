/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as jest from 'jest';
import { Config } from '@jest/types';
import * as path from 'path';
import { jestIntegrationTestProjectName } from './jest.config';

async function runIntegrationTests() {
    const repoRoot = process.env.CODE_EXTENSIONS_PATH;
    if (!repoRoot) {
        throw new Error('CODE_EXTENSIONS_PATH not set.');
    }

    const jestConfigPath = path.join(repoRoot, 'jest.config.ts');
    const { results } = await jest.runCLI(
        {
            config: jestConfigPath,
            selectProjects: [jestIntegrationTestProjectName],
            // Since we're running tests in the actual vscode process we have to run them serially.
            runInBand: true,
            // Timeout cannot be overriden in the jest config file, so override here.
            testTimeout: 120000,
            verbose: true,
        } as Config.Argv,
        [jestIntegrationTestProjectName]
    );

    if (!results.success) {
        throw new Error('Tests failed.');
    }
}

export async function run() {
    process.env.RUNNING_INTEGRATION_TESTS = 'true';

    return runIntegrationTests();
}
