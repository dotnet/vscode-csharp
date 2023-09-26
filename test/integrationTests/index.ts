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
    const jestConfig = {
        config: jestConfigPath,
        selectProjects: [jestIntegrationTestProjectName],
        // Since we're running tests in the actual vscode process we have to run them serially.
        runInBand: true,
        // Timeout cannot be overriden in the jest config file, so override here.
        testTimeout: 120000,
        verbose: true,
    } as Config.Argv;

    let filter: string;
    if (process.env.TEST_FILE_FILTER) {
        // If we have just a file, run that with runTestsByPath.
        jestConfig.runTestsByPath = true;
        jestConfig.testMatch = [process.env.TEST_FILE_FILTER];
        filter = process.env.TEST_FILE_FILTER;
    } else {
        filter = jestIntegrationTestProjectName;
    }

    const { results } = await jest.runCLI(jestConfig, [filter]);

    if (!results.success) {
        throw new Error('Tests failed.');
    }
}

export async function run() {
    process.env.RUNNING_INTEGRATION_TESTS = 'true';

    return runIntegrationTests();
}
