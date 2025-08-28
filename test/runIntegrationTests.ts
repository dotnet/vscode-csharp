/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as jest from 'jest';
import { Config } from '@jest/types';
import * as path from 'path';

export async function runIntegrationTests(projectName: string) {
    const repoRoot = process.env.CODE_EXTENSIONS_PATH;
    if (!repoRoot) {
        throw new Error('CODE_EXTENSIONS_PATH not set.');
    }

    const jestConfigPath = path.join(repoRoot, 'jest.config.ts');
    const jestConfig = {
        config: jestConfigPath,
        selectProjects: [projectName],
        // Since we're running tests in the actual vscode process we have to run them serially.
        runInBand: true,
        // Timeout cannot be overriden in the jest config file, so override here.
        testTimeout: 120000,
        verbose: true,
    } as Config.Argv;

    if (process.env.TEST_FILE_FILTER) {
        // If we have just a file, run that with an explicit match.
        jestConfig.testMatch = [process.env.TEST_FILE_FILTER];
    }

    const { results } = await jest.runCLI(jestConfig, [projectName]);

    return results;
}
