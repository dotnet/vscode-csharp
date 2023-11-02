/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type { Config } from 'jest';

const config: Config = {
    projects: [
        '<rootDir>/test/unitTests/jest.config.ts',
        '<rootDir>/test/integrationTests/jest.config.ts',
        '<rootDir>/test/razorIntegrationTests/jest.config.ts',
        '<rootDir>/test/razorTests/jest.config.ts',
        '<rootDir>/test/artifactTests/jest.config.ts',
        '<rootDir>/omnisharptest/omnisharpUnitTests/jest.config.ts',
        '<rootDir>/omnisharptest/omnisharpIntegrationTests/jest.config.ts',
    ],
    // Reporters are a global jest configuration property and cannot be set in the project jest config.
    // This configuration will create a 'junit.xml' file in the output directory, no matter which test project is running.
    // In order to not overwrite test results in CI, we configure a unique output file name in the gulp testTasks.
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: '<rootDir>/out/',
                reportTestSuiteErrors: 'true',
                // Azure DevOps does not display test suites (it ignores them entirely).
                // So we have to put all the info in the test case name so the UI shows anything relatively useful.
                // See https://github.com/microsoft/azure-pipelines-tasks/issues/7659
                titleTemplate: '{filename} / {suitename} / {title}',
            },
        ],
    ],
};

export default config;
